import { describe, expect, it } from 'vitest';
import type {
  ServiceRecord,
  ServiceRecordId,
  ServiceRecordSnapshot,
} from '../../domain/service-records/serviceRecord';
import type { VehicleId } from '../../domain/vehicles/vehicle';
import type { ServiceRecordResult } from '../service-records/serviceRecordResult';
import type {
  CreateServiceRecordDraft,
  SaveServiceRecordDraft,
  ServiceRecordRepository,
  ServiceRecordSummary,
} from './serviceRecordRepository';
import type {
  ServiceRecordSnapshotRepository,
  ServiceRecordSnapshotSummary,
} from './serviceRecordSnapshotRepository';
import type { ServiceRecordPdfRenderer } from './serviceRecordPdfRenderer';

type Expect<T extends true> = T;
type IsNever<T> = [T] extends [never] ? true : false;

type ProtectedCommandField
  = | 'ownerId'
    | 'displayNumber'
    | 'status'
    | 'version'
    | 'versionIncrement'
    | 'createdAt'
    | 'updatedAt'
    | 'completedAt'
    | 'generatedAt'
    | 'createdById';

type CreateCommand = CreateServiceRecordDraft;
type SaveCommand = SaveServiceRecordDraft;
type CompleteVersion = Parameters<ServiceRecordRepository['complete']>[1];
type DeleteVersion = Parameters<ServiceRecordRepository['deleteDraft']>[1];

const createExcludesProtectedFields: Expect<
  IsNever<Extract<keyof CreateCommand, ProtectedCommandField>>
> = true;
const saveExcludesProtectedFields: Expect<
  IsNever<Extract<keyof SaveCommand, ProtectedCommandField>>
> = true;
const completeUsesAnExpectedVersion: Expect<CompleteVersion extends number ? true : false> = true;
const deleteUsesAnExpectedVersion: Expect<DeleteVersion extends number ? true : false> = true;

const serviceRecord: ServiceRecord = {
  id: 'record-1',
  ownerId: 'user-1',
  vehicleId: 'vehicle-1',
  status: 'draft',
  serviceDate: '2026-07-22',
  odometer: 12_500,
  currencyCode: 'AUD',
  items: [],
  version: 1,
  createdAt: '2026-07-22T00:00:00.000Z',
  updatedAt: '2026-07-22T00:00:00.000Z',
};

const summary: ServiceRecordSummary = {
  id: serviceRecord.id,
  vehicleId: serviceRecord.vehicleId,
  status: serviceRecord.status,
  serviceDate: serviceRecord.serviceDate,
  odometer: serviceRecord.odometer,
  currencyCode: serviceRecord.currencyCode,
  totalPurchaseCostMinor: 0,
  version: serviceRecord.version,
};

const snapshot: ServiceRecordSnapshot = {
  id: 'snapshot-1',
  schemaVersion: 1,
  templateVersion: 1,
  brandingVersion: 1,
  serviceRecordId: 'record-1',
  displayNumber: 'SR-000001',
  status: 'completed',
  serviceRecordVersion: 2,
  serviceDate: '2026-07-22',
  generatedAt: '2026-07-22T00:00:00.000Z',
  createdById: 'user-1',
  vehicle: { make: 'Ferrari', model: 'Roma', odometerUnit: 'km' },
  odometer: 12_500,
  currencyCode: 'AUD',
  items: [],
  totalPurchaseCostMinor: 0,
};

const snapshotSummary: ServiceRecordSnapshotSummary = {
  id: snapshot.id,
  serviceRecordId: snapshot.serviceRecordId,
  displayNumber: snapshot.displayNumber,
  serviceRecordVersion: snapshot.serviceRecordVersion,
  schemaVersion: snapshot.schemaVersion,
  templateVersion: snapshot.templateVersion,
  brandingVersion: snapshot.brandingVersion,
  generatedAt: snapshot.generatedAt,
};

function success<T>(value: T): ServiceRecordResult<T> {
  return { ok: true, value };
}

class RecordingServiceRecordRepository implements ServiceRecordRepository {
  public readonly calls: string[] = [];

  public getById(id: ServiceRecordId): Promise<ServiceRecordResult<ServiceRecord | null>> {
    this.calls.push(`getById:${id}`);
    return Promise.resolve(success(serviceRecord));
  }

  public listForVehicle(vehicleId: VehicleId): Promise<ServiceRecordResult<readonly ServiceRecordSummary[]>> {
    this.calls.push(`listForVehicle:${vehicleId}`);
    return Promise.resolve(success([summary]));
  }

  public createDraft(input: CreateServiceRecordDraft): Promise<ServiceRecordResult<ServiceRecord>> {
    this.calls.push(`createDraft:${input.vehicleId}`);
    return Promise.resolve(success(serviceRecord));
  }

  public saveDraft(input: SaveServiceRecordDraft): Promise<ServiceRecordResult<ServiceRecord>> {
    this.calls.push(`saveDraft:${input.id}:${String(input.expectedVersion)}`);
    return Promise.resolve(success(serviceRecord));
  }

  public deleteDraft(id: ServiceRecordId, expectedVersion: number): Promise<ServiceRecordResult<void>> {
    this.calls.push(`deleteDraft:${id}:${String(expectedVersion)}`);
    return Promise.resolve(success(undefined));
  }

  public complete(id: ServiceRecordId, expectedVersion: number): Promise<ServiceRecordResult<ServiceRecord>> {
    this.calls.push(`complete:${id}:${String(expectedVersion)}`);
    return Promise.resolve(success({
      ...serviceRecord,
      displayNumber: 'SR-000001',
      status: 'completed',
      version: 2,
      completedAt: '2026-07-22T00:01:00.000Z',
    }));
  }
}

describe('Service Record application port shapes', () => {
  it('excludes protected fields from all caller-controlled record commands', () => {
    expect([
      createExcludesProtectedFields,
      saveExcludesProtectedFields,
      completeUsesAnExpectedVersion,
      deleteUsesAnExpectedVersion,
    ]).toEqual([true, true, true, true]);
  });

  it('exposes only business operations with app-owned models and results', async () => {
    const repository = new RecordingServiceRecordRepository();
    const create: CreateServiceRecordDraft = {
      vehicleId: serviceRecord.vehicleId,
      serviceDate: serviceRecord.serviceDate,
      odometer: serviceRecord.odometer,
    };
    const save: SaveServiceRecordDraft = {
      id: serviceRecord.id,
      expectedVersion: serviceRecord.version,
      draft: { serviceDate: serviceRecord.serviceDate, odometer: serviceRecord.odometer, items: [] },
    };

    await expect(repository.getById(serviceRecord.id)).resolves.toEqual(success(serviceRecord));
    await expect(repository.listForVehicle(serviceRecord.vehicleId)).resolves.toEqual(success([summary]));
    await expect(repository.createDraft(create)).resolves.toEqual(success(serviceRecord));
    await expect(repository.saveDraft(save)).resolves.toEqual(success(serviceRecord));
    await expect(repository.deleteDraft(serviceRecord.id, 1)).resolves.toEqual(success(undefined));
    await expect(repository.complete(serviceRecord.id, 1)).resolves.toEqual(success(expect.objectContaining({ status: 'completed' })));
    expect(repository.calls).toEqual([
      'getById:record-1',
      'listForVehicle:vehicle-1',
      'createDraft:vehicle-1',
      'saveDraft:record-1:1',
      'deleteDraft:record-1:1',
      'complete:record-1:1',
    ]);
  });

  it('keeps snapshot access and PDF rendering provider-neutral', async () => {
    const snapshots: ServiceRecordSnapshotRepository = {
      getById: () => Promise.resolve(success(snapshot)),
      listForRecord: () => Promise.resolve(success([snapshotSummary])),
      save: () => Promise.resolve(success(snapshot)),
    };
    const renderer: ServiceRecordPdfRenderer = {
      render: () => Promise.resolve(success(new Blob(['pdf']))),
    };

    await expect(snapshots.getById(snapshot.id)).resolves.toEqual(success(snapshot));
    await expect(snapshots.listForRecord(snapshot.serviceRecordId)).resolves.toEqual(success([snapshotSummary]));
    await expect(snapshots.save(snapshot)).resolves.toEqual(success(snapshot));
    await expect(renderer.render(snapshot)).resolves.toEqual(success(expect.any(Blob)));
  });
});
