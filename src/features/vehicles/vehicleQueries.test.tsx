import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { VehicleOperations } from './vehicleContext';
import { VehicleProvider } from './VehicleProvider';
import {
  useActiveVehiclesQuery,
  useArchiveVehicleMutation,
  useArchivedVehiclesQuery,
  useCreateVehicleMutation,
  useDeleteVehicleMutation,
  useRestoreVehicleMutation,
  useUpdateVehicleMutation,
  useVehicleQuery,
  clearVehiclePrivateCache,
  vehicleMutationKeys,
  vehicleQueryKeys,
} from './vehicleQueries';
import { AuthenticationContext } from '../../app/providers/authenticationContext';
import type { AuthenticationContextValue } from '../../app/providers/authenticationContext';
import type { Vehicle, VehicleSummary } from '../../domain/vehicles/vehicle';
import { createVehicleError } from '../../application/vehicles/vehicleResult';

const summary: VehicleSummary = {
  id: 'vehicle-1',
  make: 'Ferrari',
  model: 'Roma',
  year: '2021',
  registration: 'TEST 123',
  registrationState: 'WA',
  currentOdometer: 12000,
  odometerUnit: 'km',
};

const vehicle: Vehicle = {
  ...summary,
  ownerId: 'owner-1',
  vin: 'SYNTHETIC-VIN',
  engine: 'V8',
  notes: 'Private notes',
  createdAt: '2026-07-20T00:00:00.000Z',
  updatedAt: '2026-07-20T00:00:00.000Z',
};

function createOperations(
  overrides: Partial<VehicleOperations> = {},
): VehicleOperations {
  return {
    archiveVehicle: vi.fn().mockResolvedValue({ ok: true, value: vehicle }),
    createVehicle: vi.fn().mockResolvedValue({
      ok: true,
      value: { vehicle },
    }),
    deleteVehicle: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
    getVehicle: vi.fn().mockResolvedValue({ ok: true, value: vehicle }),
    listActiveVehicles: vi.fn().mockResolvedValue({
      ok: true,
      value: [summary],
    }),
    listArchivedVehicles: vi.fn().mockResolvedValue({ ok: true, value: [] }),
    restoreVehicle: vi.fn().mockResolvedValue({ ok: true, value: vehicle }),
    updateVehicle: vi.fn().mockResolvedValue({
      ok: true,
      value: { vehicle },
    }),
    ...overrides,
  };
}

function createClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { gcTime: Infinity, retry: false },
    },
  });
}

function createAuthentication(): AuthenticationContextValue {
  const state = {
    status: 'authenticated',
    user: {
      id: 'owner-1',
      displayName: 'Garage Operator',
      role: 'admin',
      createdAt: '2026-07-20T00:00:00.000Z',
      updatedAt: '2026-07-20T00:00:00.000Z',
    },
  } as const;

  return {
    completeAuthenticationRedirect: vi.fn().mockResolvedValue(state),
    registerPrivateStateCleanup: vi.fn(() => vi.fn()),
    restoreAuthentication: vi.fn().mockResolvedValue(state),
    signInWithGoogle: vi.fn().mockResolvedValue(state),
    signOut: vi.fn().mockResolvedValue({ status: 'unauthenticated' }),
    state,
  };
}

function createWrapper(
  client: QueryClient,
  operations: VehicleOperations,
) {
  const authentication = createAuthentication();

  return function Wrapper({ children }: { readonly children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <AuthenticationContext.Provider value={authentication}>
          <VehicleProvider operations={operations}>
            {children}
          </VehicleProvider>
        </AuthenticationContext.Provider>
      </QueryClientProvider>
    );
  };
}

describe('Vehicle queries', () => {
  it('uses distinct app-owned keys for active, archived, and detail data', () => {
    expect(vehicleQueryKeys.active).toEqual(['vehicles', 'active']);
    expect(vehicleQueryKeys.archived).toEqual(['vehicles', 'archived']);
    expect(vehicleQueryKeys.detail('vehicle-1')).toEqual([
      'vehicles',
      'detail',
      'vehicle-1',
    ]);
    expect(vehicleQueryKeys.duplicateFeedback(7, 'vehicle-1')).toEqual([
      'vehicles',
      'feedback',
      7,
      'vehicle-1',
    ]);
  });

  it('exposes loading and successful active Vehicle data', async () => {
    let resolveList: ((value: { readonly ok: true; readonly value: readonly VehicleSummary[] }) => void)
      | undefined;
    const pending = new Promise<{
      readonly ok: true;
      readonly value: readonly VehicleSummary[];
    }>((resolve) => {
      resolveList = resolve;
    });
    const operations = createOperations({
      listActiveVehicles: vi.fn(() => pending),
    });
    const hook = renderHook(() => useActiveVehiclesQuery(), {
      wrapper: createWrapper(createClient(), operations),
    });

    expect(hook.result.current.isPending).toBe(true);
    act(() => resolveList?.({ ok: true, value: [summary] }));

    await waitFor(() => {
      expect(hook.result.current.data).toEqual([summary]);
      expect(hook.result.current.isSuccess).toBe(true);
    });
  });

  it('exposes only the safe app-owned error returned by a query use case', async () => {
    const safeError = createVehicleError('temporary_failure');
    const operations = createOperations({
      listArchivedVehicles: vi.fn().mockResolvedValue({
        ok: false,
        error: safeError,
      }),
    });
    const hook = renderHook(() => useArchivedVehiclesQuery(), {
      wrapper: createWrapper(createClient(), operations),
    });

    await waitFor(() => {
      expect(hook.result.current.error).toMatchObject(safeError);
      expect(hook.result.current.isError).toBe(true);
    });
    expect(JSON.stringify(hook.result.current.error)).not.toMatch(/supabase|sql|token/iu);
  });

  it('loads detail through the approved use case', async () => {
    const operations = createOperations();
    const hook = renderHook(() => useVehicleQuery('vehicle-1'), {
      wrapper: createWrapper(createClient(), operations),
    });

    await waitFor(() => {
      expect(hook.result.current.data).toEqual(vehicle);
    });
    expect(operations.getVehicle).toHaveBeenCalledWith('vehicle-1');
  });
});

describe('Vehicle mutations', () => {
  it('uses one feature-owned mutation-key root for all supported operations', () => {
    expect(vehicleMutationKeys).toEqual({
      all: ['vehicles', 'mutation'],
      archive: ['vehicles', 'mutation', 'archive'],
      create: ['vehicles', 'mutation', 'create'],
      delete: ['vehicles', 'mutation', 'delete'],
      restore: ['vehicles', 'mutation', 'restore'],
      update: ['vehicles', 'mutation', 'update'],
    });
  });

  it('caches created detail and invalidates only the active list', async () => {
    const client = createClient();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const duplicateWarning = {
      vehicleId: 'vehicle-duplicate',
      label: '2021 Ferrari Roma · TEST 123 WA',
    };
    const operations = createOperations({
      createVehicle: vi.fn().mockResolvedValue({
        ok: true,
        value: { vehicle, duplicateWarning },
      }),
    });
    const hook = renderHook(() => useCreateVehicleMutation(), {
      wrapper: createWrapper(client, operations),
    });

    await act(async () => {
      const outcome = await hook.result.current.mutateAsync({
        make: 'Ferrari',
        model: 'Roma',
        odometerUnit: 'km',
      });
      expect(outcome.duplicateWarning).toEqual(duplicateWarning);
    });

    expect(client.getQueryData(vehicleQueryKeys.detail(vehicle.id))).toEqual(vehicle);
    expect(client.getQueryData(
      vehicleQueryKeys.duplicateFeedback(0, vehicle.id),
    )).toEqual(duplicateWarning);
    expect(invalidate).toHaveBeenCalledOnce();
    expect(invalidate).toHaveBeenCalledWith({
      exact: true,
      queryKey: vehicleQueryKeys.active,
    });
  });

  it.each([
    ['active', vehicle, vehicleQueryKeys.active],
    ['archived', { ...vehicle, archivedAt: '2026-07-20T01:00:00.000Z' }, vehicleQueryKeys.archived],
  ] as const)(
    'invalidates only the %s list after an update',
    async (_lifecycle, updatedVehicle, expectedKey) => {
      const client = createClient();
      const invalidate = vi.spyOn(client, 'invalidateQueries');
      const operations = createOperations({
        updateVehicle: vi.fn().mockResolvedValue({
          ok: true,
          value: { vehicle: updatedVehicle },
        }),
      });
      const hook = renderHook(() => useUpdateVehicleMutation(), {
        wrapper: createWrapper(client, operations),
      });

      await act(() => hook.result.current.mutateAsync({
        id: vehicle.id,
        input: {
          make: vehicle.make,
          model: vehicle.model,
          odometerUnit: vehicle.odometerUnit,
        },
      }));

      expect(client.getQueryData(
        vehicleQueryKeys.duplicateFeedback(0, vehicle.id),
      )).toBeUndefined();

      expect(invalidate).toHaveBeenCalledOnce();
      expect(invalidate).toHaveBeenCalledWith({
        exact: true,
        queryKey: expectedKey,
      });
    },
  );

  it.each([
    ['archive', useArchiveVehicleMutation],
    ['restore', useRestoreVehicleMutation],
  ] as const)('%s refreshes both lifecycle lists and updates detail', async (
    _operation,
    useMutationHook,
  ) => {
    const client = createClient();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const hook = renderHook(() => useMutationHook(), {
      wrapper: createWrapper(client, createOperations()),
    });

    await act(() => hook.result.current.mutateAsync(vehicle.id));

    expect(client.getQueryData(vehicleQueryKeys.detail(vehicle.id))).toEqual(vehicle);
    expect(invalidate).toHaveBeenCalledTimes(2);
    expect(invalidate).toHaveBeenCalledWith({
      exact: true,
      queryKey: vehicleQueryKeys.active,
    });
    expect(invalidate).toHaveBeenCalledWith({
      exact: true,
      queryKey: vehicleQueryKeys.archived,
    });
  });

  it('removes deleted detail and refreshes both lifecycle lists', async () => {
    const client = createClient();
    client.setQueryData(vehicleQueryKeys.detail(vehicle.id), vehicle);
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const hook = renderHook(() => useDeleteVehicleMutation(), {
      wrapper: createWrapper(client, createOperations()),
    });

    await act(() => hook.result.current.mutateAsync(vehicle.id));

    expect(client.getQueryData(vehicleQueryKeys.detail(vehicle.id))).toBeUndefined();
    expect(invalidate).toHaveBeenCalledTimes(2);
  });

  it('rejects with a safe app-owned mutation error without changing cache', async () => {
    const safeError = createVehicleError('unauthorized');
    const operations = createOperations({
      createVehicle: vi.fn().mockResolvedValue({ ok: false, error: safeError }),
    });
    const client = createClient();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const hook = renderHook(() => useCreateVehicleMutation(), {
      wrapper: createWrapper(client, operations),
    });

    await expect(hook.result.current.mutateAsync({
      make: 'Ferrari',
      model: 'Roma',
      odometerUnit: 'km',
    })).rejects.toMatchObject(safeError);
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('removes registration-state-bearing private query data during cleanup', async () => {
    const client = createClient();
    client.setQueryData(vehicleQueryKeys.active, [summary]);
    client.setQueryData(vehicleQueryKeys.detail(vehicle.id), vehicle);
    client.setQueryData(vehicleQueryKeys.duplicateFeedback(0, vehicle.id), {
      vehicleId: 'vehicle-duplicate',
      label: '2021 Ferrari Roma · TEST 123 WA',
    });

    expect(JSON.stringify(client.getQueriesData({
      queryKey: vehicleQueryKeys.all,
    }))).toContain('WA');

    await clearVehiclePrivateCache(client);

    expect(client.getQueriesData({ queryKey: vehicleQueryKeys.all })).toEqual([]);
  });
});
