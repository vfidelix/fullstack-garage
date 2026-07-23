import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { AuthenticationContext, type AuthenticationContextValue } from '../../app/providers/authenticationContext';
import { createServiceRecordError } from '../../application/service-records/serviceRecordResult';
import type { ServiceRecordOperations } from './serviceRecordContext';
import { ServiceRecordProvider } from './ServiceRecordProvider';
import {
  clearServiceRecordPrivateCache,
  serviceRecordMutationKeys,
  serviceRecordQueryKeys,
  useCompleteServiceRecordMutation,
  useServiceRecordQuery,
  useServiceRecordsForVehicleQuery,
} from './serviceRecordQueries';

const record = {
  id: 'record-1', ownerId: 'owner-1', vehicleId: 'vehicle-1', status: 'draft' as const,
  serviceDate: '2026-07-22', odometer: 12000, currencyCode: 'AUD' as const,
  items: [], version: 1, createdAt: '2026-07-22T00:00:00.000Z', updatedAt: '2026-07-22T00:00:00.000Z',
};
const summary = {
  id: record.id, vehicleId: record.vehicleId, status: record.status, serviceDate: record.serviceDate,
  odometer: record.odometer, currencyCode: record.currencyCode, version: record.version,
  totalPurchaseCostMinor: 0,
};

function createOperations(overrides: Partial<ServiceRecordOperations> = {}): ServiceRecordOperations {
  return {
    completeServiceRecord: vi.fn().mockResolvedValue({ ok: true, value: record }),
    createServiceRecordDraft: vi.fn(), createServiceRecordSnapshot: vi.fn(),
    deleteServiceRecordDraft: vi.fn(), downloadServiceRecordPdf: vi.fn(),
    getServiceRecord: vi.fn().mockResolvedValue({ ok: true, value: record }),
    listServiceRecordsForVehicle: vi.fn().mockResolvedValue({ ok: true, value: [summary] }),
    previewServiceRecordPdf: vi.fn(), saveServiceRecordDraft: vi.fn(), ...overrides,
  };
}

function createClient(): QueryClient {
  return new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { gcTime: Infinity, retry: false } } });
}

function wrapper(client: QueryClient, operations: ServiceRecordOperations) {
  const authentication: AuthenticationContextValue = {
    completeAuthenticationRedirect: vi.fn(), registerPrivateStateCleanup: vi.fn(() => vi.fn()),
    restoreAuthentication: vi.fn(), signInWithGoogle: vi.fn(), signOut: vi.fn(),
    state: { status: 'authenticated', user: { id: 'owner-1', displayName: 'Operator', role: 'admin', createdAt: record.createdAt, updatedAt: record.updatedAt } },
  };
  return function Wrapper({ children }: { readonly children: ReactNode }) {
    return <QueryClientProvider client={client}><AuthenticationContext.Provider value={authentication}><ServiceRecordProvider operations={operations}>{children}</ServiceRecordProvider></AuthenticationContext.Provider></QueryClientProvider>;
  };
}

describe('Service Record queries', () => {
  it('uses app-owned history and detail keys scoped to the Vehicle and record', () => {
    expect(serviceRecordQueryKeys.forVehicle('vehicle-1')).toEqual(['service-records', 'vehicle', 'vehicle-1']);
    expect(serviceRecordQueryKeys.detail('record-1')).toEqual(['service-records', 'detail', 'record-1']);
  });

  it('loads the Vehicle history and record detail through approved operations', async () => {
    const operations = createOperations();
    const hook = renderHook(() => ({ history: useServiceRecordsForVehicleQuery('vehicle-1'), detail: useServiceRecordQuery('record-1') }), { wrapper: wrapper(createClient(), operations) });
    await waitFor(() => {
      expect(hook.result.current.history.data).toEqual([summary]);
    });
    expect(hook.result.current.detail.data).toEqual(record);
    expect(operations.listServiceRecordsForVehicle).toHaveBeenCalledWith('vehicle-1');
    expect(operations.getServiceRecord).toHaveBeenCalledWith('record-1');
  });

  it('propagates app-owned conflicts and invalidates history after completion', async () => {
    const client = createClient();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const operations = createOperations({ completeServiceRecord: vi.fn().mockResolvedValue({ ok: true, value: { ...record, status: 'completed', displayNumber: 'SR-000001', completedAt: record.updatedAt, version: 2 } }) });
    const hook = renderHook(() => useCompleteServiceRecordMutation(), { wrapper: wrapper(client, operations) });
    await act(() => hook.result.current.mutateAsync({ id: record.id, expectedVersion: record.version }));
    expect(client.getQueryData(serviceRecordQueryKeys.detail(record.id))).toMatchObject({ status: 'completed' });
    expect(invalidate).toHaveBeenCalledWith({ exact: true, queryKey: serviceRecordQueryKeys.forVehicle(record.vehicleId) });
  });

  it('rejects query failures as safe feature errors', async () => {
    const safeError = createServiceRecordError('version_conflict');
    const hook = renderHook(() => useServiceRecordQuery(record.id), { wrapper: wrapper(createClient(), createOperations({ getServiceRecord: vi.fn().mockResolvedValue({ ok: false, error: safeError }) })) });
    await waitFor(() => {
      expect(hook.result.current.error).toMatchObject(safeError);
    });
    expect(JSON.stringify(hook.result.current.error)).not.toMatch(/supabase|sql|token/iu);
  });

  it('clears Service Record data and mutations without touching unrelated cache', async () => {
    const client = createClient();
    client.setQueryData(serviceRecordQueryKeys.detail(record.id), record);
    client.setQueryData(['unrelated'], { retain: true });
    await clearServiceRecordPrivateCache(client);
    expect(client.getQueriesData({ queryKey: serviceRecordQueryKeys.all })).toEqual([]);
    expect(client.getQueryData(['unrelated'])).toEqual({ retain: true });
    expect(serviceRecordMutationKeys.all).toEqual(['service-records', 'mutation']);
  });
});
