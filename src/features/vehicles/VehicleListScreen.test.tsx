import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { AuthenticationContextValue } from '../../app/providers/authenticationContext';
import { AuthenticationContext } from '../../app/providers/authenticationContext';
import { createVehicleError } from '../../application/vehicles/vehicleResult';
import type { Vehicle, VehicleSummary } from '../../domain/vehicles/vehicle';
import { VehicleProvider } from './VehicleProvider';
import type { VehicleOperations } from './vehicleContext';
import { VehicleListScreen } from './VehicleListScreen';

const activeVehicles: readonly VehicleSummary[] = [
  {
    id: 'vehicle-full-label',
    make: 'Ferrari',
    model: 'Roma',
    year: 2021,
    registration: 'SYN 123',
    registrationState: 'WA',
    currentOdometer: 123456,
    odometerUnit: 'km',
  },
  {
    id: 'vehicle-no-registration',
    make: 'Ferrari',
    model: '296 GTB',
    year: 2022,
    odometerUnit: 'mi',
  },
  {
    id: 'vehicle-no-year',
    make: 'Ferrari',
    model: 'Purosangue',
    registration: 'SYN 456',
    currentOdometer: 0,
    odometerUnit: 'km',
  },
  {
    id: 'vehicle-minimal-label',
    make: 'Ferrari',
    model: 'F40',
    odometerUnit: 'km',
  },
];

const archivedVehicle: VehicleSummary = {
  id: 'vehicle-archived',
  make: 'Ferrari',
  model: 'Testarossa',
  year: 1988,
  currentOdometer: 42000,
  odometerUnit: 'mi',
  archivedAt: '2026-07-20T00:00:00.000Z',
};

const vehicle: Vehicle = {
  id: 'vehicle-full-label',
  make: 'Ferrari',
  model: 'Roma',
  year: 2021,
  registration: 'SYN 123',
  registrationState: 'WA',
  currentOdometer: 123456,
  odometerUnit: 'km',
  ownerId: 'owner-1',
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
      value: activeVehicles,
    }),
    listArchivedVehicles: vi.fn().mockResolvedValue({
      ok: true,
      value: [archivedVehicle],
    }),
    restoreVehicle: vi.fn().mockResolvedValue({ ok: true, value: vehicle }),
    updateVehicle: vi.fn().mockResolvedValue({
      ok: true,
      value: { vehicle },
    }),
    ...overrides,
  };
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

function createClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { gcTime: Infinity, retry: false },
    },
  });
}

function renderScreen(
  lifecycle: 'active' | 'archived',
  operations: VehicleOperations = createOperations(),
) {
  const client = createClient();
  const initialEntry = lifecycle === 'active' ? '/vehicles' : '/vehicles/archived';

  return render(
    <QueryClientProvider client={client}>
      <AuthenticationContext.Provider value={createAuthentication()}>
        <VehicleProvider operations={operations}>
          <MemoryRouter initialEntries={[initialEntry]}>
            <VehicleListScreen lifecycle={lifecycle} />
          </MemoryRouter>
        </VehicleProvider>
      </AuthenticationContext.Provider>
    </QueryClientProvider>,
  );
}

describe('VehicleListScreen', () => {
  it('renders active Vehicles with approved labels and deterministic units', async () => {
    const operations = createOperations();
    renderScreen('active', operations);

    const list = await screen.findByRole('list', { name: 'Active Vehicles' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(4);
    expect(screen.getByRole('article', {
      name: '2021 Ferrari Roma · SYN 123 WA',
    })).toBeVisible();
    expect(screen.getByRole('article', {
      name: '2022 Ferrari 296 GTB',
    })).toBeVisible();
    expect(screen.getByRole('article', {
      name: 'Ferrari Purosangue · SYN 456',
    })).toBeVisible();
    expect(screen.getByRole('article', { name: 'Ferrari F40' })).toBeVisible();
    expect(screen.getByText('123,456 km')).toBeVisible();
    expect(screen.getByText('0 km')).toBeVisible();
    expect(screen.getByText('4 active Vehicles')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Add Vehicle' })).toHaveAttribute(
      'href',
      '/vehicles/new',
    );
    expect(screen.getByRole('link', {
      name: '2021 Ferrari Roma · SYN 123 WA',
    })).toHaveAttribute('href', '/vehicles/vehicle-full-label');
    expect(operations.listActiveVehicles).toHaveBeenCalledOnce();
    expect(operations.listArchivedVehicles).not.toHaveBeenCalled();
    expect(screen.queryByText(/owner-1|vin|notes/iu)).not.toBeInTheDocument();
  });

  it('keeps archived Vehicles in the explicit archived view', async () => {
    const operations = createOperations();
    renderScreen('archived', operations);

    expect(await screen.findByRole('article', {
      name: '1988 Ferrari Testarossa',
    })).toBeVisible();
    expect(screen.getByText('42,000 mi')).toBeVisible();
    expect(screen.getByText('Archived', { selector: 'dd' })).toBeVisible();
    expect(screen.queryByText('Ferrari Roma', { exact: false })).not.toBeInTheDocument();
    expect(operations.listArchivedVehicles).toHaveBeenCalledOnce();
    expect(operations.listActiveVehicles).not.toHaveBeenCalled();
  });

  it('announces loading without rendering stale rows', () => {
    const operations = createOperations({
      listActiveVehicles: vi.fn((): Promise<{
        readonly ok: true;
        readonly value: readonly VehicleSummary[];
      }> => new Promise(() => undefined)),
    });
    renderScreen('active', operations);

    expect(screen.getByRole('status', {
      name: 'Loading active Vehicles',
    })).toHaveAttribute('aria-live', 'polite');
    expect(screen.queryByRole('list', { name: 'Active Vehicles' }))
      .not.toBeInTheDocument();
  });

  it.each([
    ['active', 'No active Vehicles.'],
    ['archived', 'No archived Vehicles.'],
  ] as const)('shows the %s empty state', async (lifecycle, message) => {
    const operations = createOperations({
      listActiveVehicles: vi.fn().mockResolvedValue({ ok: true, value: [] }),
      listArchivedVehicles: vi.fn().mockResolvedValue({ ok: true, value: [] }),
    });
    renderScreen(lifecycle, operations);

    expect(await screen.findByText(message)).toBeVisible();
  });

  it('uses private-data-safe error copy and retries the selected list', async () => {
    const listActiveVehicles = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        error: {
          ...createVehicleError('temporary_failure'),
          message: 'SYN 123 provider detail must not be shown',
        },
      })
      .mockResolvedValueOnce({ ok: true, value: activeVehicles });
    renderScreen('active', createOperations({ listActiveVehicles }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Vehicles are temporarily unavailable. Please try again.',
    );
    expect(screen.queryByText(/SYN 123 provider detail/iu)).not.toBeInTheDocument();

    const retry = screen.getByRole('button', { name: 'Try again' });
    retry.focus();
    expect(retry).toHaveFocus();
    fireEvent.click(retry);

    expect(await screen.findByRole('list', { name: 'Active Vehicles' })).toBeVisible();
    await waitFor(() => {
      expect(listActiveVehicles).toHaveBeenCalledTimes(2);
    });
  });

  it('exposes selected, focusable lifecycle navigation', async () => {
    renderScreen('active');

    const navigation = screen.getByRole('navigation', { name: 'Vehicle views' });
    const activeLink = within(navigation).getByRole('link', { name: 'Active' });
    const archivedLink = within(navigation).getByRole('link', { name: 'Archived' });

    expect(activeLink).toHaveAttribute('aria-current', 'page');
    expect(archivedLink).not.toHaveAttribute('aria-current');
    activeLink.focus();
    expect(activeLink).toHaveFocus();
    expect(activeLink).toHaveAttribute('href', '/vehicles');
    expect(archivedLink).toHaveAttribute('href', '/vehicles/archived');
    expect(await screen.findByRole('list', { name: 'Active Vehicles' })).toBeVisible();
  });

  it('uses list, article, heading, and description semantics for responsive rows', async () => {
    renderScreen('active');

    const list = await screen.findByRole('list', { name: 'Active Vehicles' });
    const firstRow = within(list).getByRole('article', {
      name: '2021 Ferrari Roma · SYN 123 WA',
    });

    expect(within(firstRow).getByRole('heading', {
      name: '2021 Ferrari Roma · SYN 123 WA',
      level: 3,
    })).toBeVisible();
    expect(within(firstRow).getByText('Registration', { selector: 'dt' })).toBeVisible();
    expect(within(firstRow).getByText('SYN 123 WA', { selector: 'dd' })).toBeVisible();
    expect(within(firstRow).getByText('Odometer', { selector: 'dt' })).toBeVisible();
    expect(within(firstRow).getByText('123,456 km', { selector: 'dd' })).toBeVisible();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
