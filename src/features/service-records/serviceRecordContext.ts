import { createContext, useContext } from 'react';
import type { ServiceRecordUseCases } from '../../application/use-cases/service-records/serviceRecordUseCases';

export type ServiceRecordOperations = Pick<
  ServiceRecordUseCases,
  | 'completeServiceRecord'
  | 'createServiceRecordDraft'
  | 'createServiceRecordSnapshot'
  | 'deleteServiceRecordDraft'
  | 'downloadServiceRecordPdf'
  | 'getServiceRecord'
  | 'listServiceRecordsForVehicle'
  | 'previewServiceRecordPdf'
  | 'saveServiceRecordDraft'
> & Partial<Pick<ServiceRecordUseCases,
| 'listServiceRecordSnapshots'
| 'previewHistoricalServiceRecordPdf'
>>;

export interface ServiceRecordSessionGuard {
  readonly capture: () => number;
  readonly generation: number;
  readonly isCurrent: (generation: number | undefined) => boolean;
}

export const ServiceRecordContext = createContext<ServiceRecordOperations | undefined>(
  undefined,
);
export const ServiceRecordSessionContext = createContext<ServiceRecordSessionGuard | undefined>(
  undefined,
);

export function useServiceRecordOperations(): ServiceRecordOperations {
  const operations = useContext(ServiceRecordContext);
  if (operations === undefined) {
    throw new Error('Service Record hooks must be used within ServiceRecordProvider.');
  }
  return operations;
}

export function useServiceRecordSessionGuard(): ServiceRecordSessionGuard {
  const session = useContext(ServiceRecordSessionContext);
  if (session === undefined) {
    throw new Error('Service Record session hooks must be used within ServiceRecordProvider.');
  }
  return session;
}
