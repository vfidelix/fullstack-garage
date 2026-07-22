import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { AuthenticationContextValue } from '../providers/authenticationContext';
import { AuthenticationContext } from '../providers/authenticationContext';
import type { VehicleSummary } from '../../domain/vehicles/vehicle';
import { VehicleProvider } from '../../features/vehicles/VehicleProvider';
import type { VehicleOperations } from '../../features/vehicles/vehicleContext';
import { AppRoutes } from './AppRoutes';

const activeVehicle: VehicleSummary = {
  id: 'active-vehicle',
  make: 'Ferrari',
  model: 'Roma',
  year: '2021',
  odometerUnit: 'km',
};

const archivedVehicle: VehicleSummary = {
  id: 'archived-vehicle',
  make: 'Ferrari',
  model: 'F40',
  archivedAt: '2026-07-20T00:00:00.000Z',
  odometerUnit: 'km',
};

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

function createOperations(): VehicleOperations {
  return {
    archiveVehicle: vi.fn(),
    createVehicle: vi.fn(),
    deleteVehicle: vi.fn(),
    getVehicle: vi.fn(),
    listActiveVehicles: vi.fn().mockResolvedValue({
      ok: true,
      value: [activeVehicle],
    }),
    listArchivedVehicles: vi.fn().mockResolvedValue({
      ok: true,
      value: [archivedVehicle],
    }),
    restoreVehicle: vi.fn(),
    updateVehicle: vi.fn(),
  };
}

function renderRoute(path: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity, retry: false } },
  });

  render(
    <QueryClientProvider client={client}>
      <AuthenticationContext.Provider value={createAuthentication()}>
        <VehicleProvider operations={createOperations()}>
          <MemoryRouter initialEntries={[path]}>
            <AppRoutes />
          </MemoryRouter>
        </VehicleProvider>
      </AuthenticationContext.Provider>
    </QueryClientProvider>,
  );
}

describe('Vehicle routes', () => {
  it('routes the protected Vehicles destination to active Vehicles by default', async () => {
    renderRoute('/vehicles');

    expect(await screen.findByRole('article', {
      name: '2021 Ferrari Roma',
    })).toBeVisible();
    const primaryNavigation = screen.getByRole('navigation', {
      name: 'Primary navigation',
    });
    expect(within(primaryNavigation).getByRole('link', { name: 'Vehicles' }))
      .toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Active' }))
      .toHaveAttribute('aria-current', 'page');
  });

  it('routes the protected archived destination to the separate archived list', async () => {
    renderRoute('/vehicles/archived');

    expect(await screen.findByRole('article', { name: 'Ferrari F40' })).toBeVisible();
    expect(screen.queryByRole('article', { name: '2021 Ferrari Roma' }))
      .not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Archived' }))
      .toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Vehicles' }))
      .toHaveAttribute('aria-current', 'page');
  });
});
