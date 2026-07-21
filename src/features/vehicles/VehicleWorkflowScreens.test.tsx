import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import {
  act,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../../app/routes/AppRoutes';
import type { AuthenticationContextValue } from '../../app/providers/authenticationContext';
import { AuthenticationContext } from '../../app/providers/authenticationContext';
import {
  createVehicleError,
  createVehicleValidationError,
} from '../../application/vehicles/vehicleResult';
import type { Vehicle } from '../../domain/vehicles/vehicle';
import { VehicleProvider } from './VehicleProvider';
import type { VehicleOperations } from './vehicleContext';

const vehicle: Vehicle = {
  id: 'vehicle-1',
  ownerId: 'owner-private',
  make: 'Ferrari',
  model: 'Roma',
  year: 2021,
  registration: 'SYN 123',
  vin: 'SYNTHETIC-VIN',
  currentOdometer: 12000,
  odometerUnit: 'km',
  engine: 'V8',
  notes: 'Private notes',
  archivedAt: '2026-07-20T00:00:00.000Z',
  createdAt: '2026-07-20T00:00:00.000Z',
  updatedAt: '2026-07-20T00:00:00.000Z',
};

const activeVehicle: Vehicle = {
  id: 'vehicle-1',
  ownerId: 'owner-private',
  make: 'Ferrari',
  model: 'Roma',
  year: 2021,
  registration: 'SYN 123',
  vin: 'SYNTHETIC-VIN',
  currentOdometer: 12000,
  odometerUnit: 'km',
  engine: 'V8',
  notes: 'Private notes',
  createdAt: '2026-07-20T00:00:00.000Z',
  updatedAt: '2026-07-20T00:00:00.000Z',
};
const nonBmpCharacter = '\u{1F600}';

function createAuthentication(): AuthenticationContextValue {
  const state = {
    status: 'authenticated',
    user: {
      id: 'owner-private',
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

function createTransitionableAuthentication(): {
  readonly authentication: AuthenticationContextValue;
  readonly transition: () => Promise<void>;
} {
  let cleanup: (() => void | Promise<void>) | undefined;
  const authentication: AuthenticationContextValue = {
    ...createAuthentication(),
    registerPrivateStateCleanup: vi.fn((
      nextCleanup: Parameters<
        AuthenticationContextValue['registerPrivateStateCleanup']
      >[0],
    ) => {
      cleanup = nextCleanup;
      return vi.fn();
    }),
  };

  return {
    authentication,
    transition: async () => {
      await cleanup?.();
    },
  };
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

function createOperations(
  overrides: Partial<VehicleOperations> = {},
): VehicleOperations {
  return {
    archiveVehicle: vi.fn().mockResolvedValue({ ok: true, value: vehicle }),
    createVehicle: vi.fn().mockResolvedValue({
      ok: true,
      value: { vehicle: { ...vehicle, archivedAt: undefined } },
    }),
    deleteVehicle: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
    getVehicle: vi.fn().mockResolvedValue({ ok: true, value: vehicle }),
    listActiveVehicles: vi.fn().mockResolvedValue({ ok: true, value: [] }),
    listArchivedVehicles: vi.fn().mockResolvedValue({ ok: true, value: [] }),
    restoreVehicle: vi.fn().mockResolvedValue({ ok: true, value: vehicle }),
    updateVehicle: vi.fn().mockResolvedValue({
      ok: true,
      value: { vehicle },
    }),
    ...overrides,
  };
}

function LocationProbe() {
  const location = useLocation();
  return (
    <>
      <output aria-label="Test location">{`${location.pathname}${location.search}`}</output>
      <output aria-label="Test route state">{JSON.stringify(location.state)}</output>
    </>
  );
}

function renderWorkflow(
  path: string,
  operations: VehicleOperations = createOperations(),
  authentication: AuthenticationContextValue = createAuthentication(),
  strict = false,
) {
  const client = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { gcTime: Infinity, retry: false },
    },
  });

  const content = (
    <QueryClientProvider client={client}>
      <AuthenticationContext.Provider value={authentication}>
        <VehicleProvider operations={operations}>
          <MemoryRouter initialEntries={[path]}>
            <AppRoutes />
            <LocationProbe />
          </MemoryRouter>
        </VehicleProvider>
      </AuthenticationContext.Provider>
    </QueryClientProvider>
  );
  render(strict ? <StrictMode>{content}</StrictMode> : content);

  return client;
}

type WorkflowMutationKind = 'archive' | 'create' | 'delete' | 'restore' | 'update';

async function submitWorkflowMutation(
  kind: WorkflowMutationKind,
  user: ReturnType<typeof userEvent.setup>,
): Promise<void> {
  switch (kind) {
    case 'create':
      await user.type(screen.getByLabelText('Make'), 'Ferrari');
      await user.type(screen.getByLabelText('Model'), 'Roma');
      await user.click(screen.getByRole('button', { name: 'Add Vehicle' }));
      return;
    case 'update':
      await screen.findByDisplayValue('SYN 123');
      await user.click(screen.getByRole('button', { name: 'Save changes' }));
      return;
    case 'archive':
      await user.click(await screen.findByRole('button', { name: 'Archive' }));
      await user.click(screen.getByRole('button', { name: 'Archive Vehicle' }));
      return;
    case 'restore':
      await user.click(await screen.findByRole('button', { name: 'Restore' }));
      await user.click(screen.getByRole('button', { name: 'Restore Vehicle' }));
      return;
    case 'delete':
      await user.click(await screen.findByRole('button', {
        name: 'Delete permanently',
      }));
      await user.click(within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Delete permanently',
      }));
  }
}

describe('Vehicle create workflow', () => {
  it('defaults to kilometres and excludes protected fields from the form', () => {
    renderWorkflow('/vehicles/new');

    expect(screen.getByRole('heading', { level: 1, name: 'Add Vehicle' })).toBeVisible();
    expect(screen.getByRole('radio', { name: 'Kilometres' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Miles' })).not.toBeChecked();
    expect(screen.queryByLabelText(/owner|archived|created|updated/iu))
      .not.toBeInTheDocument();
    const vehicleLinks = screen.getAllByRole('link', { name: 'Vehicles' });
    expect(vehicleLinks).toHaveLength(2);
    expect(vehicleLinks.at(-1)).toHaveAttribute(
      'href',
      '/vehicles',
    );
  });

  it('counts non-BMP code points without native UTF-16 truncation', async () => {
    const user = userEvent.setup();
    const operations = createOperations();
    renderWorkflow('/vehicles/new', operations);
    const make = screen.getByLabelText('Make');
    const notes = screen.getByLabelText('Notes');

    expect(make).not.toHaveAttribute('maxlength');
    expect(notes).not.toHaveAttribute('maxlength');
    expect(make).toHaveAttribute('aria-describedby', 'vehicle-make-count');

    await user.type(make, nonBmpCharacter.repeat(51));
    await user.type(screen.getByLabelText('Model'), 'Roma');

    expect(make).toHaveValue(nonBmpCharacter.repeat(51));
    expect(screen.getByText('51 / 50 characters')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Add Vehicle' }));

    expect(await screen.findByText('Make must be 50 characters or fewer.'))
      .toBeVisible();
    expect(make).toHaveAttribute(
      'aria-describedby',
      'vehicle-make-count vehicle-make-error',
    );
    expect(operations.createVehicle).not.toHaveBeenCalled();
  });

  it('focuses the first invalid field and prevents persistence', async () => {
    const user = userEvent.setup();
    const operations = createOperations();
    renderWorkflow('/vehicles/new', operations);

    await user.click(screen.getByRole('button', { name: 'Add Vehicle' }));

    expect(await screen.findByText('Make is required.')).toBeVisible();
    expect(screen.getByLabelText('Make')).toHaveFocus();
    expect(operations.createVehicle).not.toHaveBeenCalled();
  });

  it('normalizes and persists all editable values without putting them in the URL', async () => {
    const user = userEvent.setup();
    const operations = createOperations();
    renderWorkflow('/vehicles/new', operations);

    await user.type(screen.getByLabelText('Make'), '  Ferrari  ');
    await user.type(screen.getByLabelText('Model'), '  Roma  ');
    await user.type(screen.getByLabelText('Year'), '2021');
    await user.type(screen.getByLabelText('Registration'), '  SYN 123  ');
    await user.type(screen.getByLabelText('VIN'), '  SYNTHETIC-VIN  ');
    await user.type(screen.getByLabelText('Current odometer'), '0');
    await user.click(screen.getByRole('radio', { name: 'Miles' }));
    await user.type(screen.getByLabelText('Engine'), '  V8  ');
    await user.type(screen.getByLabelText('Notes'), '  Private notes  ');
    await user.click(screen.getByRole('button', { name: 'Add Vehicle' }));

    await waitFor(() => {
      expect(operations.createVehicle).toHaveBeenCalledWith({
        make: 'Ferrari',
        model: 'Roma',
        year: 2021,
        registration: 'SYN 123',
        vin: 'SYNTHETIC-VIN',
        currentOdometer: 0,
        odometerUnit: 'mi',
        engine: 'V8',
        notes: 'Private notes',
      });
    });
    expect(await screen.findByRole('heading', {
      level: 1,
      name: '2021 Ferrari Roma · SYN 123',
    })).toBeVisible();
    const location = screen.getByRole('status', { name: 'Test location' });
    expect(location).toHaveTextContent('/vehicles/vehicle-1');
    expect(location).not.toHaveTextContent(/SYN|VIN|Private/iu);
  });

  it('saves despite a duplicate and shows the app-owned warning', async () => {
    const user = userEvent.setup();
    const duplicateWarning = {
      vehicleId: 'vehicle-duplicate',
      label: '2021 FERR ARI RO MA · SYN123',
    };
    const operations = createOperations({
      createVehicle: vi.fn().mockResolvedValue({
        ok: true,
        value: { vehicle, duplicateWarning },
      }),
    });
    const client = renderWorkflow(
      '/vehicles/new',
      operations,
      createAuthentication(),
      true,
    );

    await user.type(screen.getByLabelText('Make'), 'ferrari');
    await user.type(screen.getByLabelText('Model'), 'roma');
    await user.click(screen.getByRole('button', { name: 'Add Vehicle' }));

    const warning = await screen.findByRole('status', { name: 'Duplicate warning' });
    expect(warning).toHaveTextContent('Possible duplicate saved');
    expect(warning).toHaveTextContent('2021 FERR ARI RO MA · SYN123');
    expect(warning).toHaveTextContent('Your changes were saved.');
    const duplicateLink = within(warning).getByRole('link', {
      name: 'View matching Vehicle',
    });
    expect(duplicateLink).toHaveAttribute('href', '/vehicles/vehicle-duplicate');
    expect(screen.getByRole('status', { name: 'Test route state' }))
      .toHaveTextContent('null');
    expect(client.getQueryData(
      ['vehicles', 'feedback', 0, vehicle.id],
    )).toBeUndefined();
    expect(JSON.stringify(client.getQueriesData({
      queryKey: ['vehicles', 'feedback'],
    }))).not.toContain('SYN123');
    expect(operations.createVehicle).toHaveBeenCalledOnce();

    await user.click(duplicateLink);
    await waitFor(() => {
      expect(client.getQueryData(
        ['vehicles', 'feedback', 0, vehicle.id],
      )).toBeUndefined();
    });
    expect(screen.queryByRole('status', { name: 'Duplicate warning' }))
      .not.toBeInTheDocument();
  });

  it('uses safe server-error copy and remains retryable', async () => {
    const user = userEvent.setup();
    const createVehicle = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        error: {
          ...createVehicleError('temporary_failure'),
          message: 'SYN 123 provider detail must stay private',
        },
      })
      .mockResolvedValueOnce({ ok: true, value: { vehicle } });
    renderWorkflow('/vehicles/new', createOperations({ createVehicle }));

    await user.type(screen.getByLabelText('Make'), 'Ferrari');
    await user.type(screen.getByLabelText('Model'), 'Roma');
    await user.click(screen.getByRole('button', { name: 'Add Vehicle' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Vehicles are temporarily unavailable. Please try again.',
    );
    expect(screen.queryByText(/SYN 123 provider detail/iu)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add Vehicle' }));
    expect(await screen.findByRole('heading', {
      name: '2021 Ferrari Roma · SYN 123',
    })).toBeVisible();
    expect(createVehicle).toHaveBeenCalledTimes(2);
  });

  it('maps authoritative server validation to an accessible field error', async () => {
    const user = userEvent.setup();
    const operations = createOperations({
      createVehicle: vi.fn().mockResolvedValue({
        ok: false,
        error: createVehicleValidationError([{
          field: 'vin',
          code: 'too_long',
        }]),
      }),
    });
    renderWorkflow('/vehicles/new', operations);

    await user.type(screen.getByLabelText('Make'), 'Ferrari');
    await user.type(screen.getByLabelText('Model'), 'Roma');
    await user.click(screen.getByRole('button', { name: 'Add Vehicle' }));

    expect(await screen.findByText('This value is too long.')).toBeVisible();
    expect(screen.getByLabelText('VIN')).toHaveFocus();
    expect(screen.getByLabelText('VIN')).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows form-level feedback when server validation has no field issues', async () => {
    const user = userEvent.setup();
    const operations = createOperations({
      createVehicle: vi.fn().mockResolvedValue({
        ok: false,
        error: createVehicleValidationError([]),
      }),
    });
    renderWorkflow('/vehicles/new', operations);

    await user.type(screen.getByLabelText('Make'), 'Ferrari');
    await user.type(screen.getByLabelText('Model'), 'Roma');
    await user.click(screen.getByRole('button', { name: 'Add Vehicle' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Some Vehicle details are invalid. Review the highlighted fields.',
    );
  });
});

describe('Vehicle detail and edit workflows', () => {
  it('shows duplicate feedback after a current-session update without route state', async () => {
    const user = userEvent.setup();
    const duplicateWarning = {
      vehicleId: 'vehicle-duplicate',
      label: '2021 Ferrari Roma · REG 456',
    };
    const operations = createOperations({
      updateVehicle: vi.fn().mockResolvedValue({
        ok: true,
        value: { vehicle, duplicateWarning },
      }),
    });
    const client = renderWorkflow('/vehicles/vehicle-1/edit', operations);

    await screen.findByDisplayValue('SYN 123');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByRole('status', { name: 'Duplicate warning' }))
      .toHaveTextContent('2021 Ferrari Roma · REG 456');
    expect(screen.getByRole('status', { name: 'Test route state' }))
      .toHaveTextContent('null');
    expect(client.getQueryData(['vehicles', 'feedback', 0, vehicle.id]))
      .toEqual(duplicateWarning);
  });

  it('deep-links to every editable detail without exposing system values', async () => {
    renderWorkflow('/vehicles/vehicle-1');

    expect(await screen.findByRole('heading', {
      level: 1,
      name: '2021 Ferrari Roma · SYN 123',
    })).toBeVisible();
    expect(screen.getByText('SYNTHETIC-VIN')).toBeVisible();
    expect(screen.getByText('12,000 km')).toBeVisible();
    expect(screen.getByText('V8')).toBeVisible();
    expect(screen.getByText('Private notes')).toBeVisible();
    expect(screen.queryByText('owner-private')).not.toBeInTheDocument();
    expect(screen.queryByText('2026-07-20T00:00:00.000Z')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute(
      'href',
      '/vehicles/vehicle-1/edit',
    );
  });

  it('loads edit values, allows unit changes, and clears optional fields', async () => {
    const user = userEvent.setup();
    const updatedVehicle: Vehicle = {
      id: vehicle.id,
      ownerId: vehicle.ownerId,
      make: vehicle.make,
      model: vehicle.model,
      year: 2021,
      vin: 'SYNTHETIC-VIN',
      currentOdometer: 12000,
      odometerUnit: 'mi',
      engine: 'V8',
      archivedAt: '2026-07-20T00:00:00.000Z',
      createdAt: vehicle.createdAt,
      updatedAt: vehicle.updatedAt,
    };
    const operations = createOperations({
      updateVehicle: vi.fn().mockResolvedValue({
        ok: true,
        value: { vehicle: updatedVehicle },
      }),
    });
    renderWorkflow('/vehicles/vehicle-1/edit', operations);

    expect(await screen.findByDisplayValue('SYN 123')).toBeVisible();
    await user.clear(screen.getByLabelText('Registration'));
    await user.clear(screen.getByLabelText('Notes'));
    await user.click(screen.getByRole('radio', { name: 'Miles' }));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(operations.updateVehicle).toHaveBeenCalledWith('vehicle-1', {
        make: 'Ferrari',
        model: 'Roma',
        year: 2021,
        vin: 'SYNTHETIC-VIN',
        currentOdometer: 12000,
        odometerUnit: 'mi',
        engine: 'V8',
      });
    });
    expect(await screen.findByRole('heading', {
      level: 1,
      name: '2021 Ferrari Roma',
    })).toBeVisible();
  });

  it('announces detail loading', () => {
    const operations = createOperations({
      getVehicle: vi.fn((): Promise<never> => new Promise(() => undefined)),
    });
    renderWorkflow('/vehicles/vehicle-1', operations);

    expect(screen.getByRole('status', { name: 'Loading Vehicle details' }))
      .toHaveAttribute('aria-live', 'polite');
  });

  it('renders a safe not-found state without a futile retry', async () => {
    const operations = createOperations({
      getVehicle: vi.fn().mockResolvedValue({
        ok: false,
        error: {
          ...createVehicleError('not_found'),
          message: 'Private lookup detail',
        },
      }),
    });
    renderWorkflow('/vehicles/missing', operations);

    expect(await screen.findByRole('heading', { name: 'Vehicle not found' })).toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'This Vehicle could not be found.',
    );
    expect(screen.queryByText('Private lookup detail')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
  });

  it('retries a temporary detail failure with keyboard-focusable controls', async () => {
    const user = userEvent.setup();
    const getVehicle = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        error: createVehicleError('temporary_failure'),
      })
      .mockResolvedValueOnce({ ok: true, value: vehicle });
    renderWorkflow('/vehicles/vehicle-1', createOperations({ getVehicle }));

    const retry = await screen.findByRole('button', { name: 'Try again' });
    retry.focus();
    expect(retry).toHaveFocus();
    await user.keyboard('{Enter}');

    expect(await screen.findByRole('heading', {
      name: '2021 Ferrari Roma · SYN 123',
    })).toBeVisible();
    expect(getVehicle).toHaveBeenCalledTimes(2);
  });
});

describe('Vehicle lifecycle workflows', () => {
  it('cancels archive deliberately, traps focus, and returns focus to its trigger', async () => {
    const user = userEvent.setup();
    const operations = createOperations({
      getVehicle: vi.fn().mockResolvedValue({ ok: true, value: activeVehicle }),
    });
    renderWorkflow('/vehicles/vehicle-1', operations);

    const archiveTrigger = await screen.findByRole('button', { name: 'Archive' });
    await user.click(archiveTrigger);

    const dialog = screen.getByRole('dialog', { name: 'Archive Vehicle?' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveTextContent(
      'It will leave the active list while its details and any history remain preserved.',
    );
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();

    await user.tab();
    expect(within(dialog).getByRole('button', { name: 'Archive Vehicle' })).toHaveFocus();
    await user.tab();
    expect(within(dialog).getByRole('button', { name: 'Close confirmation' })).toHaveFocus();
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(operations.archiveVehicle).not.toHaveBeenCalled();
    expect(archiveTrigger).toHaveFocus();
  });

  it('archives once while pending and opens the archived list after refreshing it', async () => {
    const user = userEvent.setup();
    let resolveArchive: ((result: {
      readonly ok: true;
      readonly value: Vehicle;
    }) => void) | undefined;
    const archiveVehicle = vi.fn(() => new Promise<{
      readonly ok: true;
      readonly value: Vehicle;
    }>((resolve) => {
      resolveArchive = resolve;
    }));
    const listArchivedVehicles = vi.fn().mockResolvedValue({
      ok: true,
      value: [vehicle],
    });
    const operations = createOperations({
      archiveVehicle,
      getVehicle: vi.fn().mockResolvedValue({ ok: true, value: activeVehicle }),
      listArchivedVehicles,
    });
    renderWorkflow('/vehicles/vehicle-1', operations);

    await user.click(await screen.findByRole('button', { name: 'Archive' }));
    await user.click(screen.getByRole('button', { name: 'Archive Vehicle' }));

    const pendingButton = screen.getByRole('button', { name: 'Archiving Vehicle' });
    expect(pendingButton).toBeDisabled();
    expect(screen.getByRole('dialog')).toHaveFocus();
    await user.click(pendingButton);
    expect(archiveVehicle).toHaveBeenCalledOnce();

    act(() => {
      resolveArchive?.({ ok: true, value: vehicle });
    });

    expect(await screen.findByRole('article', {
      name: '2021 Ferrari Roma · SYN 123',
    })).toBeVisible();
    expect(screen.getByRole('status', { name: 'Test location' }))
      .toHaveTextContent('/vehicles/archived');
    expect(listArchivedVehicles).toHaveBeenCalledOnce();
  });

  it('shows a safe archive error and permits a successful retry', async () => {
    const user = userEvent.setup();
    const archiveVehicle = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        error: {
          ...createVehicleError('temporary_failure'),
          message: 'SYN 123 database detail must stay private',
        },
      })
      .mockResolvedValueOnce({ ok: true, value: vehicle });
    const operations = createOperations({
      archiveVehicle,
      getVehicle: vi.fn().mockResolvedValue({ ok: true, value: activeVehicle }),
      listArchivedVehicles: vi.fn().mockResolvedValue({
        ok: true,
        value: [vehicle],
      }),
    });
    renderWorkflow('/vehicles/vehicle-1', operations);

    await user.click(await screen.findByRole('button', { name: 'Archive' }));
    await user.click(screen.getByRole('button', { name: 'Archive Vehicle' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Vehicles are temporarily unavailable. Please try again.',
    );
    expect(screen.queryByText(/SYN 123 database detail/iu)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Archive Vehicle' }));

    expect(await screen.findByRole('article', {
      name: '2021 Ferrari Roma · SYN 123',
    })).toBeVisible();
    expect(archiveVehicle).toHaveBeenCalledTimes(2);
  });

  it('restores an archived Vehicle to the active list', async () => {
    const user = userEvent.setup();
    const restoreVehicle = vi.fn().mockResolvedValue({
      ok: true,
      value: activeVehicle,
    });
    const listActiveVehicles = vi.fn().mockResolvedValue({
      ok: true,
      value: [activeVehicle],
    });
    const operations = createOperations({ restoreVehicle, listActiveVehicles });
    renderWorkflow('/vehicles/vehicle-1', operations);

    await user.click(await screen.findByRole('button', { name: 'Restore' }));
    const dialog = screen.getByRole('dialog', { name: 'Restore Vehicle?' });
    expect(dialog).toHaveTextContent('It will return to the active Vehicles list.');
    await user.click(within(dialog).getByRole('button', { name: 'Restore Vehicle' }));

    expect(await screen.findByRole('article', {
      name: '2021 Ferrari Roma · SYN 123',
    })).toBeVisible();
    expect(screen.getByRole('status', { name: 'Test location' }))
      .toHaveTextContent('/vehicles');
    expect(restoreVehicle).toHaveBeenCalledOnce();
    expect(listActiveVehicles).toHaveBeenCalledOnce();
  });

  it.each([
    ['active', activeVehicle, '/vehicles', 'listActiveVehicles'],
    ['archived', vehicle, '/vehicles/archived', 'listArchivedVehicles'],
  ] as const)(
    'permanently deletes an %s Vehicle only after confirmation',
    async (_lifecycle, currentVehicle, expectedPath, listOperation) => {
      const user = userEvent.setup();
      const deleteVehicle = vi.fn().mockResolvedValue({ ok: true, value: undefined });
      const operations = createOperations({
        deleteVehicle,
        getVehicle: vi.fn().mockResolvedValue({ ok: true, value: currentVehicle }),
        listActiveVehicles: vi.fn().mockResolvedValue({ ok: true, value: [] }),
        listArchivedVehicles: vi.fn().mockResolvedValue({ ok: true, value: [] }),
      });
      renderWorkflow('/vehicles/vehicle-1', operations);

      await user.click(await screen.findByRole('button', {
        name: 'Delete permanently',
      }));
      const dialog = screen.getByRole('dialog', {
        name: 'Delete Vehicle permanently?',
      });
      expect(dialog).toHaveTextContent('cannot be undone');
      expect(dialog).not.toHaveTextContent(/Service Record|related record|history conflict|blocked/iu);

      await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
      expect(deleteVehicle).not.toHaveBeenCalled();

      await user.click(screen.getByRole('button', { name: 'Delete permanently' }));
      await user.click(within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Delete permanently',
      }));

      expect(await screen.findByText(`No ${_lifecycle} Vehicles.`)).toBeVisible();
      expect(screen.getByRole('status', { name: 'Test location' }))
        .toHaveTextContent(expectedPath);
      expect(deleteVehicle).toHaveBeenCalledOnce();
      expect(operations[listOperation]).toHaveBeenCalledOnce();
    },
  );
});

describe('Vehicle mutation authentication ownership', () => {
  it.each([
    ['create', '/vehicles/new'],
    ['update', '/vehicles/vehicle-1/edit'],
    ['archive', '/vehicles/vehicle-1'],
    ['restore', '/vehicles/vehicle-1'],
    ['delete', '/vehicles/vehicle-1'],
  ] as const)(
    'suppresses stale %s success navigation and feedback after cleanup',
    async (mutationKind, path) => {
      const user = userEvent.setup();
      const createResult = createDeferred<Awaited<
        ReturnType<VehicleOperations['createVehicle']>
      >>();
      const updateResult = createDeferred<Awaited<
        ReturnType<VehicleOperations['updateVehicle']>
      >>();
      const archiveResult = createDeferred<Awaited<
        ReturnType<VehicleOperations['archiveVehicle']>
      >>();
      const restoreResult = createDeferred<Awaited<
        ReturnType<VehicleOperations['restoreVehicle']>
      >>();
      const deleteResult = createDeferred<Awaited<
        ReturnType<VehicleOperations['deleteVehicle']>
      >>();
      const operations = createOperations({
        archiveVehicle: vi.fn(() => archiveResult.promise),
        createVehicle: vi.fn(() => createResult.promise),
        deleteVehicle: vi.fn(() => deleteResult.promise),
        getVehicle: vi.fn().mockResolvedValue({
          ok: true,
          value: mutationKind === 'archive' ? activeVehicle : vehicle,
        }),
        restoreVehicle: vi.fn(() => restoreResult.promise),
        updateVehicle: vi.fn(() => updateResult.promise),
      });
      const session = createTransitionableAuthentication();
      renderWorkflow(path, operations, session.authentication);

      await submitWorkflowMutation(mutationKind, user);
      await waitFor(() => {
        expect(operations[`${mutationKind}Vehicle`]).toHaveBeenCalledOnce();
      });
      await act(() => session.transition());

      createResult.resolve({
        ok: true,
        value: {
          vehicle: activeVehicle,
          duplicateWarning: {
            vehicleId: 'former-session-duplicate',
            label: 'Former session duplicate',
          },
        },
      });
      updateResult.resolve({ ok: true, value: { vehicle } });
      archiveResult.resolve({ ok: true, value: vehicle });
      restoreResult.resolve({ ok: true, value: activeVehicle });
      deleteResult.resolve({ ok: true, value: undefined });
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(screen.getByRole('status', { name: 'Test location' }))
        .toHaveTextContent(path);
      expect(screen.queryByRole('status', { name: 'Duplicate warning' }))
        .not.toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.getByRole('status', { name: 'Test route state' }))
        .toHaveTextContent('null');
    },
  );

  it.each([
    ['create', '/vehicles/new'],
    ['update', '/vehicles/vehicle-1/edit'],
    ['archive', '/vehicles/vehicle-1'],
    ['restore', '/vehicles/vehicle-1'],
    ['delete', '/vehicles/vehicle-1'],
  ] as const)(
    'suppresses stale %s error feedback after cleanup',
    async (mutationKind, path) => {
      const user = userEvent.setup();
      const staleFailure = createDeferred<{
        readonly ok: false;
        readonly error: ReturnType<typeof createVehicleError>;
      }>();
      const operations = createOperations({
        archiveVehicle: vi.fn(() => staleFailure.promise),
        createVehicle: vi.fn(() => staleFailure.promise),
        deleteVehicle: vi.fn(() => staleFailure.promise),
        getVehicle: vi.fn().mockResolvedValue({
          ok: true,
          value: mutationKind === 'archive' ? activeVehicle : vehicle,
        }),
        restoreVehicle: vi.fn(() => staleFailure.promise),
        updateVehicle: vi.fn(() => staleFailure.promise),
      });
      const session = createTransitionableAuthentication();
      renderWorkflow(path, operations, session.authentication);

      await submitWorkflowMutation(mutationKind, user);
      await waitFor(() => {
        expect(operations[`${mutationKind}Vehicle`]).toHaveBeenCalledOnce();
      });
      await act(() => session.transition());
      staleFailure.resolve({
        ok: false,
        error: createVehicleError('temporary_failure'),
      });
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(screen.getByRole('status', { name: 'Test location' }))
        .toHaveTextContent(path);
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    },
  );

  it('allows a current-generation save after suppressing a stale form error', async () => {
    const user = userEvent.setup();
    const staleFailure = createDeferred<Awaited<
      ReturnType<VehicleOperations['createVehicle']>
    >>();
    const createVehicle = vi.fn()
      .mockImplementationOnce(() => staleFailure.promise)
      .mockResolvedValueOnce({ ok: true, value: { vehicle: activeVehicle } });
    const session = createTransitionableAuthentication();
    renderWorkflow(
      '/vehicles/new',
      createOperations({ createVehicle }),
      session.authentication,
    );

    await submitWorkflowMutation('create', user);
    await waitFor(() => {
      expect(createVehicle).toHaveBeenCalledOnce();
    });
    await act(() => session.transition());
    staleFailure.resolve({
      ok: false,
      error: createVehicleError('temporary_failure'),
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Add Vehicle' })).toBeEnabled();
    });

    await user.click(screen.getByRole('button', { name: 'Add Vehicle' }));

    expect(await screen.findByRole('heading', {
      name: '2021 Ferrari Roma · SYN 123',
    })).toBeVisible();
    expect(createVehicle).toHaveBeenCalledTimes(2);
  });
});
