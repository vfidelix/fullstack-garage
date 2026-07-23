import type { ServiceRecordSnapshot } from '../../domain/service-records/serviceRecord';
import type { ServiceRecordResult } from '../service-records/serviceRecordResult';

export interface ServiceRecordPdfRenderer {
  render(snapshot: ServiceRecordSnapshot): Promise<ServiceRecordResult<Blob>>;
}
