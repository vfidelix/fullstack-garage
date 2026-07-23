import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { ServiceRecordPdf } from '../../application/use-cases/service-records/serviceRecordUseCases';
import type { ServiceRecordSummary } from '../../application/ports/serviceRecordRepository';
import type { ServiceRecordSnapshotSummary } from '../../application/ports/serviceRecordSnapshotRepository';
import type { ServiceRecordError, ServiceRecordErrorCategory, ServiceRecordResult } from '../../application/service-records/serviceRecordResult';
import type { ServiceRecord, ServiceRecordDraftInput, ServiceRecordId, ServiceRecordSnapshot } from '../../domain/service-records/serviceRecord';
import type { VehicleId } from '../../domain/vehicles/vehicle';
import { useServiceRecordOperations, useServiceRecordSessionGuard, type ServiceRecordSessionGuard } from './serviceRecordContext';

const SERVICE_RECORD_QUERY_ROOT = ['service-records'] as const;
const SERVICE_RECORD_MUTATION_ROOT = ['service-records', 'mutation'] as const;

export const serviceRecordQueryKeys = {
  all: SERVICE_RECORD_QUERY_ROOT,
  detail: (id: ServiceRecordId) => [...SERVICE_RECORD_QUERY_ROOT, 'detail', id] as const,
  forVehicle: (vehicleId: VehicleId) => [...SERVICE_RECORD_QUERY_ROOT, 'vehicle', vehicleId] as const,
  snapshots: (id: ServiceRecordId) => [...SERVICE_RECORD_QUERY_ROOT, 'snapshots', id] as const,
};

export const serviceRecordMutationKeys = {
  all: SERVICE_RECORD_MUTATION_ROOT,
  complete: [...SERVICE_RECORD_MUTATION_ROOT, 'complete'] as const,
  create: [...SERVICE_RECORD_MUTATION_ROOT, 'create'] as const,
  createSnapshot: [...SERVICE_RECORD_MUTATION_ROOT, 'create-snapshot'] as const,
  delete: [...SERVICE_RECORD_MUTATION_ROOT, 'delete'] as const,
  download: [...SERVICE_RECORD_MUTATION_ROOT, 'download'] as const,
  preview: [...SERVICE_RECORD_MUTATION_ROOT, 'preview'] as const,
  save: [...SERVICE_RECORD_MUTATION_ROOT, 'save'] as const,
};

export interface ServiceRecordVersionedMutationInput {
  readonly id: ServiceRecordId;
  readonly expectedVersion: number;
}
export interface CreateServiceRecordDraftMutationInput {
  readonly vehicleId: VehicleId;
  readonly serviceDate: string;
  readonly odometer: number;
}
export interface SaveServiceRecordDraftMutationInput extends ServiceRecordVersionedMutationInput {
  readonly draft: ServiceRecordDraftInput;
}
export interface DeleteServiceRecordDraftMutationInput extends ServiceRecordVersionedMutationInput {
  readonly vehicleId: VehicleId;
}
export interface HistoricalPdfMutationInput {
  readonly serviceRecordId: ServiceRecordId;
  readonly snapshotId: string;
}

export class ServiceRecordFeatureError extends Error {
  public readonly category: ServiceRecordErrorCategory;
  public readonly issues?: ServiceRecordError extends infer ErrorResult
    ? ErrorResult extends { readonly category: 'validation'; readonly issues: infer Issues }
      ? Issues
      : never
    : never;

  public constructor(error: ServiceRecordError) {
    super(error.message);
    this.name = 'ServiceRecordFeatureError';
    this.category = error.category;
    if (error.category === 'validation') {
      this.issues = error.issues;
    }
  }
}

async function unwrapServiceRecordResult<T>(resultPromise: Promise<ServiceRecordResult<T>>): Promise<T> {
  const result = await resultPromise;
  if (!result.ok) {
    throw new ServiceRecordFeatureError(result.error);
  }
  return result.value;
}

async function cacheRecordAndInvalidateHistory(
  queryClient: QueryClient,
  session: ServiceRecordSessionGuard,
  generation: number | undefined,
  record: ServiceRecord,
): Promise<void> {
  if (!session.isCurrent(generation)) return;
  queryClient.setQueryData(serviceRecordQueryKeys.detail(record.id), record);
  if (!session.isCurrent(generation)) return;
  await queryClient.invalidateQueries({ exact: true, queryKey: serviceRecordQueryKeys.forVehicle(record.vehicleId) });
}

export async function clearServiceRecordPrivateCache(queryClient: QueryClient): Promise<void> {
  const mutationCache = queryClient.getMutationCache();
  for (const mutation of mutationCache.findAll({ mutationKey: serviceRecordMutationKeys.all })) {
    mutationCache.remove(mutation);
  }
  await queryClient.cancelQueries({ queryKey: serviceRecordQueryKeys.all });
  queryClient.removeQueries({ queryKey: serviceRecordQueryKeys.all });
}

export function useServiceRecordsForVehicleQuery(vehicleId: VehicleId) {
  const operations = useServiceRecordOperations();
  return useQuery<readonly ServiceRecordSummary[], ServiceRecordFeatureError>({
    queryFn: () => unwrapServiceRecordResult(operations.listServiceRecordsForVehicle(vehicleId)),
    queryKey: serviceRecordQueryKeys.forVehicle(vehicleId),
  });
}

export function useServiceRecordQuery(id: ServiceRecordId) {
  const operations = useServiceRecordOperations();
  return useQuery<ServiceRecord, ServiceRecordFeatureError>({
    queryFn: () => unwrapServiceRecordResult(operations.getServiceRecord(id)),
    queryKey: serviceRecordQueryKeys.detail(id),
  });
}

export function useServiceRecordSnapshotsQuery(id: ServiceRecordId, enabled: boolean) {
  const operations = useServiceRecordOperations();
  return useQuery<readonly ServiceRecordSnapshotSummary[], ServiceRecordFeatureError>({
    enabled: enabled && operations.listServiceRecordSnapshots !== undefined,
    queryFn: () => {
      if (operations.listServiceRecordSnapshots === undefined) {
        throw new ServiceRecordFeatureError({
          category: 'temporary_failure',
          message: 'Historical exports are temporarily unavailable.',
        });
      }
      return unwrapServiceRecordResult(operations.listServiceRecordSnapshots(id));
    },
    queryKey: serviceRecordQueryKeys.snapshots(id),
  });
}

export function useCreateServiceRecordDraftMutation() {
  const operations = useServiceRecordOperations();
  const queryClient = useQueryClient();
  const session = useServiceRecordSessionGuard();
  return useMutation<ServiceRecord, ServiceRecordFeatureError, CreateServiceRecordDraftMutationInput, number>({
    mutationKey: serviceRecordMutationKeys.create,
    mutationFn: (input) => unwrapServiceRecordResult(operations.createServiceRecordDraft(input)),
    onMutate: () => session.capture(),
    onSuccess: (record, _input, generation) => cacheRecordAndInvalidateHistory(queryClient, session, generation, record),
  });
}

export function useSaveServiceRecordDraftMutation() {
  const operations = useServiceRecordOperations();
  const queryClient = useQueryClient();
  const session = useServiceRecordSessionGuard();
  return useMutation<ServiceRecord, ServiceRecordFeatureError, SaveServiceRecordDraftMutationInput, number>({
    mutationKey: serviceRecordMutationKeys.save,
    mutationFn: ({ id, expectedVersion, draft }) => unwrapServiceRecordResult(operations.saveServiceRecordDraft(id, expectedVersion, draft)),
    onMutate: () => session.capture(),
    onSuccess: (record, _input, generation) => cacheRecordAndInvalidateHistory(queryClient, session, generation, record),
  });
}

export function useDeleteServiceRecordDraftMutation() {
  const operations = useServiceRecordOperations();
  const queryClient = useQueryClient();
  const session = useServiceRecordSessionGuard();
  return useMutation<undefined, ServiceRecordFeatureError, DeleteServiceRecordDraftMutationInput, number>({
    mutationKey: serviceRecordMutationKeys.delete,
    mutationFn: async ({ id, expectedVersion }) => {
      await unwrapServiceRecordResult(operations.deleteServiceRecordDraft(id, expectedVersion));
      return undefined;
    },
    onMutate: () => session.capture(),
    onSuccess: async (_result, input, generation) => {
      if (!session.isCurrent(generation)) return;
      queryClient.removeQueries({ exact: true, queryKey: serviceRecordQueryKeys.detail(input.id) });
      if (!session.isCurrent(generation)) return;
      await queryClient.invalidateQueries({ exact: true, queryKey: serviceRecordQueryKeys.forVehicle(input.vehicleId) });
    },
  });
}

export function useCompleteServiceRecordMutation() {
  const operations = useServiceRecordOperations();
  const queryClient = useQueryClient();
  const session = useServiceRecordSessionGuard();
  return useMutation<ServiceRecord, ServiceRecordFeatureError, ServiceRecordVersionedMutationInput, number>({
    mutationKey: serviceRecordMutationKeys.complete,
    mutationFn: ({ id, expectedVersion }) => unwrapServiceRecordResult(operations.completeServiceRecord(id, expectedVersion)),
    onMutate: () => session.capture(),
    onSuccess: (record, _input, generation) => cacheRecordAndInvalidateHistory(queryClient, session, generation, record),
  });
}

function usePdfMutation(
  mutationKey: readonly string[],
  operation: (id: ServiceRecordId) => Promise<ServiceRecordResult<ServiceRecordPdf>>,
) {
  const session = useServiceRecordSessionGuard();
  return useMutation<ServiceRecordPdf, ServiceRecordFeatureError, ServiceRecordId, number>({
    mutationKey,
    mutationFn: (id) => unwrapServiceRecordResult(operation(id)),
    onMutate: () => session.capture(),
  });
}

export function useCreateServiceRecordSnapshotMutation() {
  const operations = useServiceRecordOperations();
  const session = useServiceRecordSessionGuard();
  return useMutation<ServiceRecordSnapshot, ServiceRecordFeatureError, ServiceRecordId, number>({
    mutationKey: serviceRecordMutationKeys.createSnapshot,
    mutationFn: (id) => unwrapServiceRecordResult(operations.createServiceRecordSnapshot(id)),
    onMutate: () => session.capture(),
  });
}

export function usePreviewServiceRecordPdfMutation() {
  const operations = useServiceRecordOperations();
  return usePdfMutation(serviceRecordMutationKeys.preview, (id) => operations.previewServiceRecordPdf(id));
}

export function useDownloadServiceRecordPdfMutation() {
  const operations = useServiceRecordOperations();
  return usePdfMutation(serviceRecordMutationKeys.download, (id) => operations.downloadServiceRecordPdf(id));
}

export function usePreviewHistoricalServiceRecordPdfMutation() {
  const operations = useServiceRecordOperations();
  const session = useServiceRecordSessionGuard();
  return useMutation<ServiceRecordPdf, ServiceRecordFeatureError, HistoricalPdfMutationInput, number>({
    mutationKey: [...serviceRecordMutationKeys.preview, 'historical'],
    mutationFn: ({ serviceRecordId, snapshotId }) => {
      if (operations.previewHistoricalServiceRecordPdf === undefined) {
        return Promise.reject(new ServiceRecordFeatureError({
          category: 'temporary_failure',
          message: 'Historical exports are temporarily unavailable.',
        }));
      }
      return unwrapServiceRecordResult(
        operations.previewHistoricalServiceRecordPdf(serviceRecordId, snapshotId),
      );
    },
    onMutate: () => session.capture(),
  });
}
