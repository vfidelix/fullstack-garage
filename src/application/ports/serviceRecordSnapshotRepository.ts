import type {
  ServiceRecordId,
  ServiceRecordSnapshot,
  ServiceRecordSnapshotId,
} from '../../domain/service-records/serviceRecord';
import type { ServiceRecordResult } from '../service-records/serviceRecordResult';

export interface ServiceRecordSnapshotSummary {
  readonly id: ServiceRecordSnapshotId;
  readonly serviceRecordId: ServiceRecordId;
  readonly displayNumber: string;
  readonly serviceRecordVersion: number;
  readonly schemaVersion: number;
  readonly templateVersion: number;
  readonly brandingVersion: number;
  readonly generatedAt: string;
}

export interface ServiceRecordSnapshotRepository {
  getById(
    id: ServiceRecordSnapshotId,
  ): Promise<ServiceRecordResult<ServiceRecordSnapshot | null>>;
  listForRecord(
    id: ServiceRecordId,
  ): Promise<ServiceRecordResult<readonly ServiceRecordSnapshotSummary[]>>;
  save(
    snapshot: ServiceRecordSnapshot,
  ): Promise<ServiceRecordResult<ServiceRecordSnapshot>>;
}
