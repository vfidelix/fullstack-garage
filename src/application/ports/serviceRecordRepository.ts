import type {
  ServiceRecord,
  ServiceRecordDraftInput,
  ServiceRecordId,
  ServiceRecordStatus,
} from '../../domain/service-records/serviceRecord';
import type { VehicleId } from '../../domain/vehicles/vehicle';
import type { ServiceRecordResult } from '../service-records/serviceRecordResult';

export interface ServiceRecordSummary {
  readonly id: ServiceRecordId;
  readonly vehicleId: VehicleId;
  readonly displayNumber?: string;
  readonly status: ServiceRecordStatus;
  readonly serviceDate: string;
  readonly odometer: number;
  readonly summary?: string;
  readonly currencyCode: 'AUD';
  readonly totalPurchaseCostMinor: number;
  readonly version: number;
  readonly completedAt?: string;
}

export interface CreateServiceRecordDraft {
  readonly vehicleId: VehicleId;
  readonly serviceDate: string;
  readonly odometer: number;
}

export interface SaveServiceRecordDraft {
  readonly id: ServiceRecordId;
  readonly expectedVersion: number;
  readonly draft: ServiceRecordDraftInput;
}

export interface ServiceRecordRepository {
  getById(id: ServiceRecordId): Promise<ServiceRecordResult<ServiceRecord | null>>;
  listForVehicle(
    vehicleId: VehicleId,
  ): Promise<ServiceRecordResult<readonly ServiceRecordSummary[]>>;
  createDraft(
    input: CreateServiceRecordDraft,
  ): Promise<ServiceRecordResult<ServiceRecord>>;
  saveDraft(
    input: SaveServiceRecordDraft,
  ): Promise<ServiceRecordResult<ServiceRecord>>;
  deleteDraft(
    id: ServiceRecordId,
    expectedVersion: number,
  ): Promise<ServiceRecordResult<void>>;
  complete(
    id: ServiceRecordId,
    expectedVersion: number,
  ): Promise<ServiceRecordResult<ServiceRecord>>;
}
