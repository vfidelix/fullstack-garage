import {
  skipToken,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { useEffect } from 'react';
import type {
  VehicleDuplicateWarning,
} from '../../application/ports/vehicleRepository';
import type {
  VehicleMutationOutcome,
} from '../../application/use-cases/vehicles/vehicleUseCases';
import type {
  VehicleError,
  VehicleErrorCategory,
  VehicleResult,
} from '../../application/vehicles/vehicleResult';
import type {
  CreateVehicle,
  UpdateVehicle,
  Vehicle,
  VehicleId,
  VehicleSummary,
  VehicleValidationIssue,
} from '../../domain/vehicles/vehicle';
import {
  useVehicleOperations,
  useVehicleSessionGuard,
  type VehicleSessionGuard,
} from './vehicleContext';

const VEHICLE_QUERY_ROOT = ['vehicles'] as const;
const VEHICLE_MUTATION_ROOT = ['vehicles', 'mutation'] as const;

export const vehicleQueryKeys = {
  all: VEHICLE_QUERY_ROOT,
  active: [...VEHICLE_QUERY_ROOT, 'active'] as const,
  archived: [...VEHICLE_QUERY_ROOT, 'archived'] as const,
  detail: (id: VehicleId) => [...VEHICLE_QUERY_ROOT, 'detail', id] as const,
  duplicateFeedback: (generation: number, id: VehicleId) => (
    [...VEHICLE_QUERY_ROOT, 'feedback', generation, id] as const
  ),
};

export const vehicleMutationKeys = {
  all: VEHICLE_MUTATION_ROOT,
  archive: [...VEHICLE_MUTATION_ROOT, 'archive'] as const,
  create: [...VEHICLE_MUTATION_ROOT, 'create'] as const,
  delete: [...VEHICLE_MUTATION_ROOT, 'delete'] as const,
  restore: [...VEHICLE_MUTATION_ROOT, 'restore'] as const,
  update: [...VEHICLE_MUTATION_ROOT, 'update'] as const,
};

export interface UpdateVehicleMutationInput {
  readonly id: VehicleId;
  readonly input: UpdateVehicle;
}

export class VehicleFeatureError extends Error {
  public readonly category: VehicleErrorCategory;
  public readonly issues?: readonly VehicleValidationIssue[];

  public constructor(error: VehicleError) {
    super(error.message);
    this.name = 'VehicleFeatureError';
    this.category = error.category;

    if (error.category === 'validation') {
      this.issues = error.issues;
    }
  }
}

async function unwrapVehicleResult<T>(
  resultPromise: Promise<VehicleResult<T>>,
): Promise<T> {
  const result = await resultPromise;

  if (!result.ok) {
    throw new VehicleFeatureError(result.error);
  }

  return result.value;
}

async function invalidateLifecycleLists(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({
      exact: true,
      queryKey: vehicleQueryKeys.active,
    }),
    queryClient.invalidateQueries({
      exact: true,
      queryKey: vehicleQueryKeys.archived,
    }),
  ]);
}

async function invalidateLifecycleListsForSession(
  queryClient: QueryClient,
  session: VehicleSessionGuard,
  generation: number | undefined,
): Promise<void> {
  if (!session.isCurrent(generation)) {
    return;
  }

  await invalidateLifecycleLists(queryClient);
}

function cacheDuplicateFeedback(
  queryClient: QueryClient,
  session: VehicleSessionGuard,
  generation: number | undefined,
  outcome: VehicleMutationOutcome,
): void {
  if (!session.isCurrent(generation) || generation === undefined) {
    return;
  }

  const queryKey = vehicleQueryKeys.duplicateFeedback(
    generation,
    outcome.vehicle.id,
  );

  if (outcome.duplicateWarning === undefined) {
    queryClient.removeQueries({ exact: true, queryKey });
    return;
  }

  queryClient.setQueryData(queryKey, outcome.duplicateWarning);
}

async function cacheVehicleAndInvalidateLifecycle(
  queryClient: QueryClient,
  session: VehicleSessionGuard,
  generation: number | undefined,
  outcome: VehicleMutationOutcome,
): Promise<void> {
  if (!session.isCurrent(generation)) {
    return;
  }

  const { vehicle } = outcome;
  queryClient.setQueryData(vehicleQueryKeys.detail(vehicle.id), vehicle);
  cacheDuplicateFeedback(queryClient, session, generation, outcome);

  if (!session.isCurrent(generation)) {
    return;
  }

  await queryClient.invalidateQueries({
    exact: true,
    queryKey: vehicle.archivedAt === undefined
      ? vehicleQueryKeys.active
      : vehicleQueryKeys.archived,
  });
}

export async function clearVehiclePrivateCache(
  queryClient: QueryClient,
): Promise<void> {
  const mutationCache = queryClient.getMutationCache();
  const privateMutations = mutationCache.findAll({
    mutationKey: vehicleMutationKeys.all,
  });

  for (const mutation of privateMutations) {
    mutationCache.remove(mutation);
  }

  await queryClient.cancelQueries({ queryKey: vehicleQueryKeys.all });
  queryClient.removeQueries({ queryKey: vehicleQueryKeys.all });
}

export function useActiveVehiclesQuery() {
  const operations = useVehicleOperations();

  return useQuery<readonly VehicleSummary[], VehicleFeatureError>({
    queryFn: () => unwrapVehicleResult(operations.listActiveVehicles()),
    queryKey: vehicleQueryKeys.active,
  });
}

export function useArchivedVehiclesQuery() {
  const operations = useVehicleOperations();

  return useQuery<readonly VehicleSummary[], VehicleFeatureError>({
    queryFn: () => unwrapVehicleResult(operations.listArchivedVehicles()),
    queryKey: vehicleQueryKeys.archived,
  });
}

export function useVehicleQuery(id: VehicleId) {
  const operations = useVehicleOperations();

  return useQuery<Vehicle, VehicleFeatureError>({
    queryFn: () => unwrapVehicleResult(operations.getVehicle(id)),
    queryKey: vehicleQueryKeys.detail(id),
  });
}

export function useVehicleDuplicateWarning(id: VehicleId) {
  const queryClient = useQueryClient();
  const session = useVehicleSessionGuard();
  const generation = session.generation;
  const queryKey = vehicleQueryKeys.duplicateFeedback(generation, id);
  const query = useQuery<VehicleDuplicateWarning>({
    queryFn: skipToken,
    queryKey,
  });

  useEffect(() => () => {
    queryClient.removeQueries({
      exact: true,
      queryKey: vehicleQueryKeys.duplicateFeedback(generation, id),
    });
  }, [generation, id, queryClient]);

  return query.data;
}

export function useCreateVehicleMutation() {
  const operations = useVehicleOperations();
  const queryClient = useQueryClient();
  const session = useVehicleSessionGuard();

  return useMutation<
    VehicleMutationOutcome,
    VehicleFeatureError,
    CreateVehicle,
    number
  >({
    mutationKey: vehicleMutationKeys.create,
    mutationFn: (input) => unwrapVehicleResult(operations.createVehicle(input)),
    onMutate: () => session.capture(),
    onSuccess: async (outcome, _input, generation) => {
      if (!session.isCurrent(generation)) {
        return;
      }

      queryClient.setQueryData(
        vehicleQueryKeys.detail(outcome.vehicle.id),
        outcome.vehicle,
      );
      cacheDuplicateFeedback(queryClient, session, generation, outcome);

      if (!session.isCurrent(generation)) {
        return;
      }

      await queryClient.invalidateQueries({
        exact: true,
        queryKey: vehicleQueryKeys.active,
      });
    },
  });
}

export function useUpdateVehicleMutation() {
  const operations = useVehicleOperations();
  const queryClient = useQueryClient();
  const session = useVehicleSessionGuard();

  return useMutation<
    VehicleMutationOutcome,
    VehicleFeatureError,
    UpdateVehicleMutationInput,
    number
  >({
    mutationKey: vehicleMutationKeys.update,
    mutationFn: ({ id, input }) => unwrapVehicleResult(
      operations.updateVehicle(id, input),
    ),
    onMutate: () => session.capture(),
    onSuccess: (outcome, _input, generation) => cacheVehicleAndInvalidateLifecycle(
      queryClient,
      session,
      generation,
      outcome,
    ),
  });
}

export function useArchiveVehicleMutation() {
  const operations = useVehicleOperations();
  const queryClient = useQueryClient();
  const session = useVehicleSessionGuard();

  return useMutation<Vehicle, VehicleFeatureError, VehicleId, number>({
    mutationKey: vehicleMutationKeys.archive,
    mutationFn: (id) => unwrapVehicleResult(operations.archiveVehicle(id)),
    onMutate: () => session.capture(),
    onSuccess: async (vehicle, _id, generation) => {
      if (!session.isCurrent(generation)) {
        return;
      }

      queryClient.setQueryData(vehicleQueryKeys.detail(vehicle.id), vehicle);
      await invalidateLifecycleListsForSession(queryClient, session, generation);
    },
  });
}

export function useRestoreVehicleMutation() {
  const operations = useVehicleOperations();
  const queryClient = useQueryClient();
  const session = useVehicleSessionGuard();

  return useMutation<Vehicle, VehicleFeatureError, VehicleId, number>({
    mutationKey: vehicleMutationKeys.restore,
    mutationFn: (id) => unwrapVehicleResult(operations.restoreVehicle(id)),
    onMutate: () => session.capture(),
    onSuccess: async (vehicle, _id, generation) => {
      if (!session.isCurrent(generation)) {
        return;
      }

      queryClient.setQueryData(vehicleQueryKeys.detail(vehicle.id), vehicle);
      await invalidateLifecycleListsForSession(queryClient, session, generation);
    },
  });
}

export function useDeleteVehicleMutation() {
  const operations = useVehicleOperations();
  const queryClient = useQueryClient();
  const session = useVehicleSessionGuard();

  return useMutation<undefined, VehicleFeatureError, VehicleId, number>({
    mutationKey: vehicleMutationKeys.delete,
    mutationFn: async (id) => {
      await unwrapVehicleResult(operations.deleteVehicle(id));
      return undefined;
    },
    onMutate: () => session.capture(),
    onSuccess: async (_result, id, generation) => {
      if (!session.isCurrent(generation)) {
        return;
      }

      queryClient.removeQueries({
        exact: true,
        queryKey: vehicleQueryKeys.detail(id),
      });
      await invalidateLifecycleListsForSession(queryClient, session, generation);
    },
  });
}
