import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import {
  act,
  render,
  renderHook,
  waitFor,
} from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { AuthGateway } from '../../application/ports/authGateway';
import type { AuthenticationSessionEvents } from '../../application/ports/authenticationSessionEvents';
import { AuthenticationController } from '../../application/use-cases/auth/authenticationController';
import type { VehicleMutationOutcome } from '../../application/use-cases/vehicles/vehicleUseCases';
import type { VehicleResult } from '../../application/vehicles/vehicleResult';
import { createVehicleError } from '../../application/vehicles/vehicleResult';
import type { AppUser } from '../../domain/users/appUser';
import type { Vehicle } from '../../domain/vehicles/vehicle';
import { AuthenticationProvider } from '../../app/providers/AuthenticationProvider';
import type { VehicleOperations } from './vehicleContext';
import { VehicleProvider } from './VehicleProvider';
import {
  useArchiveVehicleMutation,
  useCreateVehicleMutation,
  useDeleteVehicleMutation,
  useRestoreVehicleMutation,
  useUpdateVehicleMutation,
  useVehicleDuplicateWarning,
  vehicleMutationKeys,
  vehicleQueryKeys,
} from './vehicleQueries';

const userA: AppUser = {
  id: 'user-a',
  displayName: 'Garage Operator A',
  role: 'admin',
  createdAt: '2026-07-20T00:00:00.000Z',
  updatedAt: '2026-07-20T00:00:00.000Z',
};

const userB: AppUser = {
  ...userA,
  id: 'user-b',
  displayName: 'Garage Operator B',
};

const userAVehicle: Vehicle = {
  id: 'vehicle-1',
  ownerId: userA.id,
  make: 'Ferrari',
  model: 'Roma',
  odometerUnit: 'km',
  notes: 'user A private notes',
  createdAt: '2026-07-20T00:00:00.000Z',
  updatedAt: '2026-07-20T00:00:00.000Z',
};

const userBVehicle: Vehicle = {
  ...userAVehicle,
  ownerId: userB.id,
  notes: 'user B private notes',
};

function createOperations(
  overrides: Partial<VehicleOperations> = {},
): VehicleOperations {
  return {
    archiveVehicle: vi.fn(),
    createVehicle: vi.fn(),
    deleteVehicle: vi.fn(),
    getVehicle: vi.fn(),
    listActiveVehicles: vi.fn(),
    listArchivedVehicles: vi.fn(),
    restoreVehicle: vi.fn(),
    updateVehicle: vi.fn(),
    ...overrides,
  };
}

function createClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity, retry: false } },
  });
}

function createDeferred<T>(): {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
} {
  let resolvePromise: ((value: T) => void) | undefined;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });

  if (resolvePromise === undefined) {
    throw new Error('Deferred promise was not initialized.');
  }

  return { promise, resolve: resolvePromise };
}

function createSessionEvents() {
  let listener: (() => void) | undefined;
  const events: AuthenticationSessionEvents = {
    subscribe: vi.fn((nextListener: () => void) => {
      listener = nextListener;
      return vi.fn();
    }),
  };

  return { emit: () => listener?.(), events };
}

function Harness({
  children,
  client,
  controller,
  events,
  operations = createOperations(),
}: {
  readonly children?: ReactNode;
  readonly client: QueryClient;
  readonly controller: AuthenticationController;
  readonly events: AuthenticationSessionEvents;
  readonly operations?: VehicleOperations;
}) {
  return (
    <QueryClientProvider client={client}>
      <AuthenticationProvider controller={controller} sessionEvents={events}>
        <VehicleProvider operations={operations}>
          {children}
        </VehicleProvider>
      </AuthenticationProvider>
    </QueryClientProvider>
  );
}

function useVehicleMutationsForTest() {
  return {
    archive: useArchiveVehicleMutation(),
    create: useCreateVehicleMutation(),
    delete: useDeleteVehicleMutation(),
    restore: useRestoreVehicleMutation(),
    update: useUpdateVehicleMutation(),
  };
}

type MutationKind = keyof ReturnType<typeof useVehicleMutationsForTest>;

const mutationKinds = [
  'create',
  'update',
  'archive',
  'restore',
  'delete',
] as const satisfies readonly MutationKind[];

function getMutationVariables(kind: MutationKind): unknown {
  switch (kind) {
    case 'create':
      return {
        make: 'Ferrari',
        model: 'Roma',
        odometerUnit: 'km',
      };
    case 'update':
      return {
        id: userAVehicle.id,
        input: {
          make: 'Ferrari',
          model: 'Roma',
          odometerUnit: 'km',
        },
      };
    case 'archive':
    case 'restore':
    case 'delete':
      return userAVehicle.id;
  }
}

function getVehicleMutations(client: QueryClient) {
  return client.getMutationCache().findAll({
    mutationKey: vehicleMutationKeys.all,
  });
}

function startMutation(
  kind: MutationKind,
  mutations: ReturnType<typeof useVehicleMutationsForTest>,
): Promise<unknown> {
  switch (kind) {
    case 'create':
      return mutations.create.mutateAsync(getMutationVariables(kind) as {
        readonly make: string;
        readonly model: string;
        readonly odometerUnit: 'km';
      });
    case 'update':
      return mutations.update.mutateAsync(getMutationVariables(kind) as {
        readonly id: string;
        readonly input: {
          readonly make: string;
          readonly model: string;
          readonly odometerUnit: 'km';
        };
      });
    case 'archive':
      return mutations.archive.mutateAsync(userAVehicle.id);
    case 'restore':
      return mutations.restore.mutateAsync(userAVehicle.id);
    case 'delete':
      return mutations.delete.mutateAsync(userAVehicle.id);
  }
}

describe('VehicleProvider private-cache cleanup', () => {
  it.each(['sign-out', 'identity replacement'] as const)(
    'stops an active detail observer from rendering %s duplicate feedback',
    async (transition) => {
      const restore = vi.fn()
        .mockResolvedValueOnce({ status: 'authenticated', user: userA })
        .mockResolvedValueOnce({ status: 'authenticated', user: userB });
      const controller = new AuthenticationController({
        restore,
        signInWithGoogle: vi.fn().mockResolvedValue(undefined),
        signOut: vi.fn().mockResolvedValue(undefined),
      });
      const client = createClient();
      const session = createSessionEvents();
      const wrapper = ({ children }: { readonly children: ReactNode }) => (
        <Harness
          client={client}
          controller={controller}
          events={session.events}
        >
          {children}
        </Harness>
      );
      const hook = renderHook(
        () => useVehicleDuplicateWarning(userAVehicle.id),
        { wrapper },
      );

      await waitFor(() => {
        expect(controller.getCurrentAppUser()).toEqual(userA);
      });
      const privateWarning = {
        vehicleId: 'user-a-duplicate',
        label: '2021 Ferrari Roma · USER A 123',
      };
      act(() => {
        client.setQueryData(
          vehicleQueryKeys.duplicateFeedback(0, userAVehicle.id),
          privateWarning,
        );
      });
      await waitFor(() => {
        expect(hook.result.current).toEqual(privateWarning);
      });

      if (transition === 'sign-out') {
        await act(() => controller.signOut());
        await act(() => controller.restoreAuthentication());
      } else {
        await act(() => controller.restoreAuthentication());
      }

      expect(controller.getCurrentAppUser()).toEqual(userB);
      await waitFor(() => {
        expect(hook.result.current).toBeUndefined();
      });
      expect(client.getQueriesData({
        queryKey: vehicleQueryKeys.duplicateFeedback(0, userAVehicle.id),
      })).toEqual([]);
      expect(JSON.stringify(client.getQueriesData({
        queryKey: vehicleQueryKeys.all,
      }))).not.toContain('USER A 123');
    },
  );

  it('removes all Vehicle data and preserves unrelated cache on sign-out', async () => {
    const gateway: AuthGateway = {
      restore: vi.fn().mockResolvedValue({ status: 'authenticated', user: userA }),
      signInWithGoogle: vi.fn().mockResolvedValue(undefined),
      signOut: vi.fn().mockResolvedValue(undefined),
    };
    const controller = new AuthenticationController(gateway);
    const client = createClient();
    const { events } = createSessionEvents();
    render(<Harness client={client} controller={controller} events={events} />);

    await waitFor(() => {
      expect(controller.state.status).toBe('authenticated');
    });
    client.setQueryData(vehicleQueryKeys.active, [{ id: 'private-active' }]);
    client.setQueryData(vehicleQueryKeys.archived, [{ id: 'private-archived' }]);
    client.setQueryData(vehicleQueryKeys.detail('private-id'), {
      notes: 'private notes',
    });
    client.setQueryData(vehicleQueryKeys.duplicateFeedback(0, 'private-id'), {
      vehicleId: 'private-duplicate-id',
      label: '2021 Ferrari Roma · PRIVATE 123',
    });
    client.setQueryData(['public-reference'], 'preserved');
    const settledVehicleMutation = client.getMutationCache().build(client, {
      mutationFn: (variables: { readonly notes: string }) => (
        Promise.resolve(variables)
      ),
      mutationKey: vehicleMutationKeys.create,
    });
    const unrelatedMutation = client.getMutationCache().build(client, {
      mutationFn: (value: string) => Promise.resolve(value),
      mutationKey: ['unrelated-mutation'],
    });
    await act(async () => {
      await settledVehicleMutation.execute({ notes: 'private mutation notes' });
      await unrelatedMutation.execute('preserved');
    });

    expect(getVehicleMutations(client)[0]?.state).toMatchObject({
      data: { notes: 'private mutation notes' },
      status: 'success',
      variables: { notes: 'private mutation notes' },
    });

    await act(() => controller.signOut());

    expect(client.getQueriesData({ queryKey: vehicleQueryKeys.all })).toEqual([]);
    expect(getVehicleMutations(client)).toEqual([]);
    expect(client.getMutationCache().findAll({
      mutationKey: ['unrelated-mutation'],
    })).toHaveLength(1);
    expect(client.getQueryData(['public-reference'])).toBe('preserved');
  });

  it('clears Vehicle data before committing a changed identity', async () => {
    const restore = vi.fn()
      .mockResolvedValueOnce({ status: 'authenticated', user: userA })
      .mockResolvedValueOnce({ status: 'authenticated', user: userB });
    const controller = new AuthenticationController({
      restore,
      signInWithGoogle: vi.fn().mockResolvedValue(undefined),
      signOut: vi.fn().mockResolvedValue(undefined),
    });
    const client = createClient();
    const session = createSessionEvents();
    render(
      <Harness
        client={client}
        controller={controller}
        events={session.events}
      />,
    );

    await waitFor(() => {
      expect(controller.getCurrentAppUser()).toEqual(userA);
    });
    client.setQueryData(vehicleQueryKeys.detail('user-a-vehicle'), {
      notes: 'user A private notes',
    });
    client.setQueryData(vehicleQueryKeys.duplicateFeedback(0, 'user-a-vehicle'), {
      vehicleId: 'user-a-duplicate',
      label: '2021 Ferrari Roma · USER A 123',
    });

    act(() => session.emit());

    await waitFor(() => {
      expect(controller.getCurrentAppUser()).toEqual(userB);
    });
    expect(client.getQueriesData({ queryKey: vehicleQueryKeys.all })).toEqual([]);
  });

  it('cancels a stale query so its late result cannot repopulate signed-out cache', async () => {
    const gateway: AuthGateway = {
      restore: vi.fn().mockResolvedValue({ status: 'authenticated', user: userA }),
      signInWithGoogle: vi.fn().mockResolvedValue(undefined),
      signOut: vi.fn().mockResolvedValue(undefined),
    };
    const controller = new AuthenticationController(gateway);
    const client = createClient();
    const session = createSessionEvents();
    render(
      <Harness
        client={client}
        controller={controller}
        events={session.events}
      />,
    );
    await waitFor(() => {
      expect(controller.getCurrentAppUser()).toEqual(userA);
    });
    const staleResult = createDeferred<{ readonly notes: string }>();
    const staleFetch = client.fetchQuery({
      queryFn: () => staleResult.promise,
      queryKey: vehicleQueryKeys.active,
    });
    const staleFetchOutcome = staleFetch.catch((error: unknown) => error);
    await waitFor(() => {
      expect(client.getQueryState(vehicleQueryKeys.active)?.fetchStatus).toBe('fetching');
    });

    await act(() => controller.signOut());
    staleResult.resolve({ notes: 'user A private notes' });
    await expect(staleFetchOutcome).resolves.toMatchObject({
      message: 'CancelledError',
    });

    expect(client.getQueriesData({ queryKey: vehicleQueryKeys.all })).toEqual([]);
  });

  it.each([
    ...mutationKinds.map((kind) => ['sign-out', kind] as const),
    ...mutationKinds.map((kind) => ['identity replacement', kind] as const),
  ])(
    'blocks stale %s %s completion effects and permits the new session',
    async (transition, mutationKind) => {
      const createResult = createDeferred<VehicleResult<VehicleMutationOutcome>>();
      const updateResult = createDeferred<VehicleResult<VehicleMutationOutcome>>();
      const archiveResult = createDeferred<VehicleResult<Vehicle>>();
      const restoreResult = createDeferred<VehicleResult<Vehicle>>();
      const deleteResult = createDeferred<VehicleResult<undefined>>();
      const operations = createOperations({
        archiveVehicle: vi.fn()
          .mockImplementationOnce(() => archiveResult.promise)
          .mockResolvedValue({ ok: true, value: userBVehicle }),
        createVehicle: vi.fn()
          .mockImplementationOnce(() => createResult.promise)
          .mockResolvedValue({
            ok: true,
            value: { vehicle: userBVehicle },
          }),
        deleteVehicle: vi.fn()
          .mockImplementationOnce(() => deleteResult.promise)
          .mockResolvedValue({ ok: true, value: undefined }),
        restoreVehicle: vi.fn()
          .mockImplementationOnce(() => restoreResult.promise)
          .mockResolvedValue({ ok: true, value: userBVehicle }),
        updateVehicle: vi.fn()
          .mockImplementationOnce(() => updateResult.promise)
          .mockResolvedValue({
            ok: true,
            value: { vehicle: userBVehicle },
          }),
      });
      const restore = vi.fn()
        .mockResolvedValueOnce({ status: 'authenticated', user: userA })
        .mockResolvedValueOnce({ status: 'authenticated', user: userB });
      const controller = new AuthenticationController({
        restore,
        signInWithGoogle: vi.fn().mockResolvedValue(undefined),
        signOut: vi.fn().mockResolvedValue(undefined),
      });
      const client = createClient();
      const invalidate = vi.spyOn(client, 'invalidateQueries');
      const session = createSessionEvents();
      const wrapper = ({ children }: { readonly children: ReactNode }) => (
        <Harness
          client={client}
          controller={controller}
          events={session.events}
          operations={operations}
        >
          {children}
        </Harness>
      );
      const hook = renderHook(useVehicleMutationsForTest, { wrapper });

      await waitFor(() => {
        expect(controller.getCurrentAppUser()).toEqual(userA);
      });

      let staleMutation: Promise<unknown> | undefined;
      act(() => {
        staleMutation = startMutation(mutationKind, hook.result.current);
      });
      await waitFor(() => {
        expect(operations[`${mutationKind}Vehicle`]).toHaveBeenCalledOnce();
      });
      expect(getVehicleMutations(client)).toHaveLength(1);
      expect(getVehicleMutations(client)[0]?.options.mutationKey)
        .toEqual(vehicleMutationKeys[mutationKind]);
      expect(getVehicleMutations(client)[0]?.state).toMatchObject({
        status: 'pending',
        variables: getMutationVariables(mutationKind),
      });

      if (transition === 'sign-out') {
        await act(() => controller.signOut());
        await act(() => controller.restoreAuthentication());
      } else {
        await act(() => controller.restoreAuthentication());
      }
      expect(controller.getCurrentAppUser()).toEqual(userB);
      expect(getVehicleMutations(client)).toEqual([]);

      client.setQueryData(vehicleQueryKeys.detail(userBVehicle.id), userBVehicle);
      client.setQueryData(vehicleQueryKeys.active, [userBVehicle]);
      client.setQueryData(vehicleQueryKeys.archived, []);

      const staleDuplicateWarning = {
        vehicleId: 'user-a-duplicate',
        label: '2021 Ferrari Roma · USER A 123',
      };
      createResult.resolve({
        ok: true,
        value: { vehicle: userAVehicle, duplicateWarning: staleDuplicateWarning },
      });
      updateResult.resolve({
        ok: true,
        value: { vehicle: userAVehicle, duplicateWarning: staleDuplicateWarning },
      });
      archiveResult.resolve({ ok: true, value: userAVehicle });
      restoreResult.resolve({ ok: true, value: userAVehicle });
      deleteResult.resolve({ ok: true, value: undefined });
      await act(async () => {
        await staleMutation;
      });

      expect(getVehicleMutations(client)).toEqual([]);
      expect(client.getQueryData(vehicleQueryKeys.detail(userBVehicle.id)))
        .toEqual(userBVehicle);
      expect(client.getQueryData(vehicleQueryKeys.active)).toEqual([userBVehicle]);
      expect(client.getQueryData(vehicleQueryKeys.archived)).toEqual([]);
      expect(client.getQueriesData({ queryKey: ['vehicles', 'feedback'] }))
        .toEqual([]);
      expect(invalidate).not.toHaveBeenCalled();

      invalidate.mockClear();
      await act(() => startMutation(mutationKind, hook.result.current));

      expect(getVehicleMutations(client)).toHaveLength(1);
      expect(getVehicleMutations(client)[0]?.state).toMatchObject({
        status: 'success',
        variables: getMutationVariables(mutationKind),
      });

      if (mutationKind === 'delete') {
        expect(client.getQueryData(vehicleQueryKeys.detail(userBVehicle.id)))
          .toBeUndefined();
      } else {
        expect(client.getQueryData(vehicleQueryKeys.detail(userBVehicle.id)))
          .toEqual(userBVehicle);
      }
      expect(invalidate).toHaveBeenCalled();
    },
  );

  it.each([
    ...mutationKinds.map((kind) => ['sign-out', kind] as const),
    ...mutationKinds.map((kind) => ['identity replacement', kind] as const),
  ])(
    'does not restore private mutation state after late %s %s failure',
    async (transition, mutationKind) => {
      const createResult = createDeferred<VehicleResult<VehicleMutationOutcome>>();
      const updateResult = createDeferred<VehicleResult<VehicleMutationOutcome>>();
      const archiveResult = createDeferred<VehicleResult<Vehicle>>();
      const restoreResult = createDeferred<VehicleResult<Vehicle>>();
      const deleteResult = createDeferred<VehicleResult<undefined>>();
      const operations = createOperations({
        archiveVehicle: vi.fn(() => archiveResult.promise),
        createVehicle: vi.fn(() => createResult.promise),
        deleteVehicle: vi.fn(() => deleteResult.promise),
        restoreVehicle: vi.fn(() => restoreResult.promise),
        updateVehicle: vi.fn(() => updateResult.promise),
      });
      const restore = vi.fn()
        .mockResolvedValueOnce({ status: 'authenticated', user: userA })
        .mockResolvedValueOnce({ status: 'authenticated', user: userB });
      const controller = new AuthenticationController({
        restore,
        signInWithGoogle: vi.fn().mockResolvedValue(undefined),
        signOut: vi.fn().mockResolvedValue(undefined),
      });
      const client = createClient();
      const session = createSessionEvents();
      const wrapper = ({ children }: { readonly children: ReactNode }) => (
        <Harness
          client={client}
          controller={controller}
          events={session.events}
          operations={operations}
        >
          {children}
        </Harness>
      );
      const hook = renderHook(useVehicleMutationsForTest, { wrapper });

      await waitFor(() => {
        expect(controller.getCurrentAppUser()).toEqual(userA);
      });

      const staleMutation = startMutation(mutationKind, hook.result.current)
        .catch((error: unknown) => error);
      await waitFor(() => {
        expect(getVehicleMutations(client)).toHaveLength(1);
      });

      if (transition === 'sign-out') {
        await act(() => controller.signOut());
        await act(() => controller.restoreAuthentication());
      } else {
        await act(() => controller.restoreAuthentication());
      }
      expect(controller.getCurrentAppUser()).toEqual(userB);
      expect(getVehicleMutations(client)).toEqual([]);

      const safeError = createVehicleError('temporary_failure');
      createResult.resolve({ ok: false, error: safeError });
      updateResult.resolve({ ok: false, error: safeError });
      archiveResult.resolve({ ok: false, error: safeError });
      restoreResult.resolve({ ok: false, error: safeError });
      deleteResult.resolve({ ok: false, error: safeError });

      await expect(staleMutation).resolves.toMatchObject({
        category: safeError.category,
        message: safeError.message,
      });
      expect(getVehicleMutations(client)).toEqual([]);
    },
  );
});
