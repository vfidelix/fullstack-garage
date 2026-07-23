import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../../app/routes/AppRoutes';
import type { AuthenticationContextValue } from '../../app/providers/authenticationContext';
import { AuthenticationContext } from '../../app/providers/authenticationContext';
import type { ServiceRecordSummary } from '../../application/ports/serviceRecordRepository';
import type { Vehicle } from '../../domain/vehicles/vehicle';
import { ServiceRecordProvider } from './ServiceRecordProvider';
import type { ServiceRecordOperations } from './serviceRecordContext';
import { VehicleProvider } from '../vehicles/VehicleProvider';
import type { VehicleOperations } from '../vehicles/vehicleContext';

const activeVehicle: Vehicle = {
  id: 'active-vehicle', ownerId: 'owner-1', make: 'Ferrari', model: 'Roma',
  odometerUnit: 'km', createdAt: '2026-07-22T00:00:00.000Z', updatedAt: '2026-07-22T00:00:00.000Z',
};
const archivedVehicle: Vehicle = {
  ...activeVehicle, id: 'archived-vehicle', model: 'F40', archivedAt: '2026-07-22T00:00:00.000Z',
};
const completedRecord: ServiceRecordSummary = {
  id: 'completed-record', vehicleId: archivedVehicle.id, displayNumber: 'SR-000001', status: 'completed',
  serviceDate: '2026-07-20', odometer: 12000, currencyCode: 'AUD', totalPurchaseCostMinor: 0, version: 2,
};
const draftRecord: ServiceRecordSummary = {
  id: 'draft-record', vehicleId: archivedVehicle.id, status: 'draft',
  serviceDate: '2026-07-21', odometer: 12100, currencyCode: 'AUD', totalPurchaseCostMinor: 0, version: 1,
};

function authentication(status: 'authenticated' | 'unauthenticated' = 'authenticated'): AuthenticationContextValue {
  const state = status === 'authenticated'
    ? { status, user: { id: 'owner-1', displayName: 'Garage Operator', role: 'admin' as const, createdAt: activeVehicle.createdAt, updatedAt: activeVehicle.updatedAt } }
    : { status };
  return {
    completeAuthenticationRedirect: vi.fn(), registerPrivateStateCleanup: vi.fn(() => vi.fn()),
    restoreAuthentication: vi.fn(), signInWithGoogle: vi.fn(), signOut: vi.fn(), state,
  };
}

function vehicleOperations(): VehicleOperations {
  return {
    archiveVehicle: vi.fn(), createVehicle: vi.fn(), deleteVehicle: vi.fn(),
    getVehicle: vi.fn((id: string) => Promise.resolve({
      ok: true,
      value: id === archivedVehicle.id ? archivedVehicle : activeVehicle,
    } as const)),
    listActiveVehicles: vi.fn(), listArchivedVehicles: vi.fn(), restoreVehicle: vi.fn(), updateVehicle: vi.fn(),
  };
}

function serviceRecordOperations(): ServiceRecordOperations {
  return {
    completeServiceRecord: vi.fn(), createServiceRecordDraft: vi.fn(), createServiceRecordSnapshot: vi.fn(),
    deleteServiceRecordDraft: vi.fn(), downloadServiceRecordPdf: vi.fn(), getServiceRecord: vi.fn(),
    listServiceRecordsForVehicle: vi.fn(() => Promise.resolve({
      ok: true,
      value: [completedRecord, draftRecord],
    } as const)),
    previewServiceRecordPdf: vi.fn(), saveServiceRecordDraft: vi.fn(),
  };
}

function renderRoute(path: string, status: 'authenticated' | 'unauthenticated' = 'authenticated') {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <AuthenticationContext.Provider value={authentication(status)}>
        <VehicleProvider operations={vehicleOperations()}>
          <ServiceRecordProvider operations={serviceRecordOperations()}>
            <MemoryRouter initialEntries={[path]}><AppRoutes /></MemoryRouter>
          </ServiceRecordProvider>
        </VehicleProvider>
      </AuthenticationContext.Provider>
    </QueryClientProvider>,
  );
}

describe('Service Record routes and Vehicle history', () => {
  it('shows active Vehicle history with an accessible new-record action and record links', async () => {
    renderRoute('/vehicles/active-vehicle');

    const createLink = await screen.findByRole('link', { name: 'Add Service Record' }, { timeout: 5_000 });
    const history = screen.getByRole('region', { name: 'Service History' });
    expect(createLink).toHaveAttribute(
      'href', '/vehicles/active-vehicle/service-records/new',
    );
    expect(within(history).getByRole('link', { name: 'View SR-000001' })).toHaveAttribute(
      'href', '/service-records/completed-record',
    );
  });

  it('keeps only completed history visible for an archived Vehicle and suppresses creation', async () => {
    renderRoute('/vehicles/archived-vehicle');

    await screen.findByText('SR-000001');
    const history = screen.getByRole('region', { name: 'Service History' });
    expect(within(history).getByText('SR-000001')).toBeVisible();
    expect(within(history).queryByText('Draft from 2026-07-21')).not.toBeInTheDocument();
    expect(within(history).queryByRole('link', { name: 'Add Service Record' })).not.toBeInTheDocument();
  });

  it('keeps Service Record deep links inside the protected route boundary', () => {
    renderRoute('/vehicles/active-vehicle/service-records/new', 'unauthenticated');

    expect(screen.getByRole('heading', { name: 'Garage Admin sign in' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'New Service Record' })).not.toBeInTheDocument();
  });
});
