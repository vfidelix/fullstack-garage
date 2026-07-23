import {
  createServiceRecordSnapshot,
  validateCompletionEligibility,
  validateOdometerChronology,
  validateServiceRecordDraft,
  type ServiceRecord,
  type ServiceRecordDraftInput,
  type ServiceRecordId,
  type ServiceRecordSnapshot,
  type ServiceRecordSnapshotVehicle,
} from '../../../domain/service-records/serviceRecord';
import { isGarageAdmin, type AppUser, type AppUserId } from '../../../domain/users/appUser';
import type { Vehicle, VehicleId } from '../../../domain/vehicles/vehicle';
import type { ServiceRecordPdfRenderer } from '../../ports/serviceRecordPdfRenderer';
import type { ServiceRecordRepository, ServiceRecordSummary } from '../../ports/serviceRecordRepository';
import type { ServiceRecordSnapshotRepository } from '../../ports/serviceRecordSnapshotRepository';
import type { ServiceRecordSnapshotSummary } from '../../ports/serviceRecordSnapshotRepository';
import type { VehicleRepository } from '../../ports/vehicleRepository';
import {
  createServiceRecordError,
  createServiceRecordValidationError,
  type ServiceRecordResult,
} from '../../service-records/serviceRecordResult';

export interface CurrentAppUserSource {
  getCurrentAppUser(): AppUser | null;
}

export interface ServiceRecordSnapshotSource {
  createId(): string;
  now(): string;
}

export interface ServiceRecordPdf {
  readonly snapshot: ServiceRecordSnapshot;
  readonly pdf: Blob;
}

const SNAPSHOT_SCHEMA_VERSION = 1;
const PDF_TEMPLATE_VERSION = 1;
const BRANDING_VERSION = 1;

export class ServiceRecordUseCases {
  public constructor(
    private readonly records: ServiceRecordRepository,
    private readonly vehicles: VehicleRepository,
    private readonly snapshots: ServiceRecordSnapshotRepository,
    private readonly renderer: ServiceRecordPdfRenderer,
    private readonly currentUserSource: CurrentAppUserSource,
    private readonly snapshotSource: ServiceRecordSnapshotSource,
  ) {}

  public async createServiceRecordDraft(input: {
    readonly vehicleId: VehicleId;
    readonly serviceDate: string;
    readonly odometer: number;
  }): Promise<ServiceRecordResult<ServiceRecord>> {
    const validation = validateServiceRecordDraft({
      serviceDate: input.serviceDate,
      odometer: input.odometer,
      items: [],
    });
    if (!validation.valid) {
      return { ok: false, error: createServiceRecordValidationError(validation.issues) };
    }
    const chronology = await this.validateKnownChronology(input.vehicleId, input.serviceDate, input.odometer);
    if (chronology !== null) return chronology;
    return this.runAuthorized(() => this.records.createDraft(input));
  }

  public listServiceRecordsForVehicle(
    vehicleId: VehicleId,
  ): Promise<ServiceRecordResult<readonly ServiceRecordSummary[]>> {
    return this.runAuthorized(() => this.records.listForVehicle(vehicleId));
  }

  public async getServiceRecord(id: ServiceRecordId): Promise<ServiceRecordResult<ServiceRecord>> {
    const result = await this.runAuthorized(() => this.records.getById(id));
    if (!result.ok) {
      return result;
    }
    return result.value === null ? this.notFound() : { ok: true, value: result.value };
  }

  public async saveServiceRecordDraft(
    id: ServiceRecordId,
    expectedVersion: number,
    draft: ServiceRecordDraftInput,
  ): Promise<ServiceRecordResult<ServiceRecord>> {
    const validation = validateServiceRecordDraft(draft);
    if (!validation.valid) {
      return { ok: false, error: createServiceRecordValidationError(validation.issues) };
    }
    const existing = await this.getServiceRecord(id);
    if (!existing.ok) return existing;
    const chronology = await this.validateKnownChronology(existing.value.vehicleId, validation.value.serviceDate, validation.value.odometer, id);
    if (chronology !== null) return chronology;
    return this.runAuthorized(() => this.records.saveDraft({
      id,
      expectedVersion,
      draft: validation.value,
    }));
  }

  public deleteServiceRecordDraft(
    id: ServiceRecordId,
    expectedVersion: number,
  ): Promise<ServiceRecordResult<void>> {
    return this.runAuthorized(() => this.records.deleteDraft(id, expectedVersion));
  }

  public async completeServiceRecord(
    id: ServiceRecordId,
    expectedVersion: number,
  ): Promise<ServiceRecordResult<ServiceRecord>> {
    const record = await this.getServiceRecord(id);
    if (!record.ok) {
      return record;
    }
    const validation = validateCompletionEligibility(record.value);
    if (!validation.valid) {
      return { ok: false, error: createServiceRecordValidationError(validation.issues) };
    }
    return this.runAuthorized(() => this.records.complete(id, expectedVersion));
  }

  public async createServiceRecordSnapshot(
    id: ServiceRecordId,
  ): Promise<ServiceRecordResult<ServiceRecordSnapshot>> {
    const initiatingUser = this.currentGarageAdmin();
    if (initiatingUser === null) {
      return this.unauthorized();
    }

    const recordResult = await this.call(() => this.records.getById(id));
    if (!this.hasSameGarageAdmin(initiatingUser.id)) {
      return this.unauthorized();
    }
    if (!recordResult.ok) {
      return recordResult;
    }
    const record = recordResult.value;
    if (record === null) {
      return this.notFound();
    }
    if (record.status !== 'completed' || record.displayNumber === undefined) {
      return this.lifecycleConflict();
    }

    const vehicleResult = await this.callVehicle(() => this.vehicles.getById(record.vehicleId));
    if (!this.hasSameGarageAdmin(initiatingUser.id)) {
      return this.unauthorized();
    }
    if (!vehicleResult.ok) {
      return vehicleResult;
    }

    try {
      return {
        ok: true,
        value: createServiceRecordSnapshot({
          id: this.snapshotSource.createId(),
          schemaVersion: SNAPSHOT_SCHEMA_VERSION,
          templateVersion: PDF_TEMPLATE_VERSION,
          brandingVersion: BRANDING_VERSION,
          generatedAt: this.snapshotSource.now(),
          createdById: initiatingUser.id,
          record,
          vehicle: this.snapshotVehicle(vehicleResult.value),
        }),
      };
    } catch {
      return this.temporaryFailure();
    }
  }

  public async previewServiceRecordPdf(id: ServiceRecordId): Promise<ServiceRecordResult<ServiceRecordPdf>> {
    const snapshot = await this.createServiceRecordSnapshot(id);
    if (!snapshot.ok) {
      return snapshot;
    }
    const pdf = await this.runAuthorized(() => this.renderer.render(snapshot.value));
    return pdf.ok ? { ok: true, value: { snapshot: snapshot.value, pdf: pdf.value } } : pdf;
  }

  public async downloadServiceRecordPdf(id: ServiceRecordId): Promise<ServiceRecordResult<ServiceRecordPdf>> {
    const snapshot = await this.createServiceRecordSnapshot(id);
    if (!snapshot.ok) {
      return snapshot;
    }
    const savedSnapshot = await this.runAuthorized(() => this.snapshots.save(snapshot.value));
    if (!savedSnapshot.ok) {
      return savedSnapshot;
    }
    const pdf = await this.runAuthorized(() => this.renderer.render(savedSnapshot.value));
    return pdf.ok ? { ok: true, value: { snapshot: savedSnapshot.value, pdf: pdf.value } } : pdf;
  }

  public async listServiceRecordSnapshots(
    id: ServiceRecordId,
  ): Promise<ServiceRecordResult<readonly ServiceRecordSnapshotSummary[]>> {
    const record = await this.getServiceRecord(id);
    if (!record.ok) {
      return record;
    }
    if (record.value.status !== 'completed') {
      return this.lifecycleConflict();
    }
    return this.runAuthorized(() => this.snapshots.listForRecord(id));
  }

  public async previewHistoricalServiceRecordPdf(
    id: ServiceRecordId,
    snapshotId: string,
  ): Promise<ServiceRecordResult<ServiceRecordPdf>> {
    const record = await this.getServiceRecord(id);
    if (!record.ok) {
      return record;
    }
    if (record.value.status !== 'completed') {
      return this.lifecycleConflict();
    }

    const snapshot = await this.runAuthorized(() => this.snapshots.getById(snapshotId));
    if (!snapshot.ok) {
      return snapshot;
    }
    const historicalSnapshot = snapshot.value;
    if (historicalSnapshot?.serviceRecordId !== id) {
      return this.notFound();
    }

    const pdf = await this.runAuthorized(() => this.renderer.render(historicalSnapshot));
    return pdf.ok ? { ok: true, value: { snapshot: historicalSnapshot, pdf: pdf.value } } : pdf;
  }

  private async runAuthorized<T>(operation: () => Promise<ServiceRecordResult<T>>): Promise<ServiceRecordResult<T>> {
    const initiatingUser = this.currentGarageAdmin();
    if (initiatingUser === null) {
      return this.unauthorized();
    }
    const result = await this.call(operation);
    return this.hasSameGarageAdmin(initiatingUser.id) ? result : this.unauthorized();
  }

  private async validateKnownChronology(
    vehicleId: VehicleId,
    serviceDate: string,
    odometer: number,
    excludeId?: ServiceRecordId,
  ): Promise<ServiceRecordResult<never> | null> {
    const history = await this.runAuthorized(() => this.records.listForVehicle(vehicleId));
    if (!history.ok) return history;
    const chronology = validateOdometerChronology(
      serviceDate,
      odometer,
      history.value.filter((record) => record.id !== excludeId).map((record) => ({ ...record, ownerId: '', items: [], createdAt: '', updatedAt: '' })),
    );
    return chronology.valid ? null : { ok: false, error: createServiceRecordError('chronology_conflict') };
  }

  private currentGarageAdmin(): AppUser | null {
    try {
      const user = this.currentUserSource.getCurrentAppUser();
      return user !== null && isGarageAdmin(user) ? user : null;
    } catch {
      return null;
    }
  }

  private hasSameGarageAdmin(initiatingUserId: AppUserId): boolean {
    return this.currentGarageAdmin()?.id === initiatingUserId;
  }

  private async call<T>(operation: () => Promise<ServiceRecordResult<T>>): Promise<ServiceRecordResult<T>> {
    try {
      return await operation();
    } catch {
      return this.temporaryFailure();
    }
  }

  private async callVehicle(operation: () => Promise<Awaited<ReturnType<VehicleRepository['getById']>>>): Promise<ServiceRecordResult<Vehicle>> {
    try {
      const result = await operation();
      if (result.ok) {
        return { ok: true, value: result.value };
      }
      return result.error.category === 'not_found' ? this.notFound() : this.temporaryFailure();
    } catch {
      return this.temporaryFailure();
    }
  }

  private snapshotVehicle(vehicle: Vehicle): ServiceRecordSnapshotVehicle {
    return {
      make: vehicle.make,
      model: vehicle.model,
      ...(vehicle.year === undefined ? {} : { year: vehicle.year }),
      ...(vehicle.registration === undefined ? {} : { registration: vehicle.registration }),
      ...(vehicle.registrationState === undefined ? {} : { registrationState: vehicle.registrationState }),
      ...(vehicle.vin === undefined ? {} : { vin: vehicle.vin }),
      ...(vehicle.engine === undefined ? {} : { engine: vehicle.engine }),
      odometerUnit: vehicle.odometerUnit,
    };
  }

  private unauthorized<T>(): ServiceRecordResult<T> {
    return { ok: false, error: createServiceRecordError('unauthorized') };
  }

  private notFound<T>(): ServiceRecordResult<T> {
    return { ok: false, error: createServiceRecordError('not_found') };
  }

  private lifecycleConflict<T>(): ServiceRecordResult<T> {
    return { ok: false, error: createServiceRecordError('lifecycle_conflict') };
  }

  private temporaryFailure<T>(): ServiceRecordResult<T> {
    return { ok: false, error: createServiceRecordError('temporary_failure') };
  }
}
