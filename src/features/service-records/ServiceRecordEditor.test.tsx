import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { ServiceRecord } from '../../domain/service-records/serviceRecord';
import type { Vehicle } from '../../domain/vehicles/vehicle';
import type { ServiceRecordOperations } from './serviceRecordContext';
import { ServiceRecordProvider } from './ServiceRecordProvider';
import { ServiceRecordEditor } from './ServiceRecordEditor';
import { VehicleProvider } from '../vehicles/VehicleProvider';
import { AuthenticationContext } from '../../app/providers/authenticationContext';

const vehicle: Vehicle = {
  id: 'vehicle-1', ownerId: 'owner-1', make: 'Ferrari', model: 'Roma', odometerUnit: 'km',
  createdAt: '2026-07-01T00:00:00.000Z', updatedAt: '2026-07-01T00:00:00.000Z',
};
const draft: ServiceRecord = {
  id: 'record-1', ownerId: 'owner-1', vehicleId: vehicle.id, status: 'draft', serviceDate: '2026-07-20',
  odometer: 12000, currencyCode: 'AUD', items: [], version: 1,
  createdAt: '2026-07-20T00:00:00.000Z', updatedAt: '2026-07-20T00:00:00.000Z',
};
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

function renderEditor() {
  const saveServiceRecordDraft = vi.fn<ServiceRecordOperations['saveServiceRecordDraft']>((_id, _expectedVersion, nextDraft) => Promise.resolve({ ok: true, value: { ...draft, ...nextDraft, version: 2, updatedAt: '2026-07-20T00:01:00.000Z' } } as const));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <AuthenticationContext.Provider value={{ completeAuthenticationRedirect: vi.fn(), registerPrivateStateCleanup: vi.fn(() => vi.fn()), restoreAuthentication: vi.fn(), signInWithGoogle: vi.fn(), signOut: vi.fn(), state: { status: 'authenticated', user: { id: 'owner-1', role: 'admin', displayName: 'Admin', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' } } }}>
        <VehicleProvider operations={{
          createVehicle: vi.fn(), updateVehicle: vi.fn(), getVehicle: vi.fn(() => Promise.resolve({ ok: true, value: vehicle } as const)),
          listActiveVehicles: vi.fn(), listArchivedVehicles: vi.fn(), archiveVehicle: vi.fn(), restoreVehicle: vi.fn(), deleteVehicle: vi.fn(),
        }}
        >
          <ServiceRecordProvider operations={{
            getServiceRecord: vi.fn(() => Promise.resolve({ ok: true, value: draft } as const)), listServiceRecordsForVehicle: vi.fn(() => Promise.resolve({ ok: true, value: [] } as const)),
            saveServiceRecordDraft, createServiceRecordDraft: vi.fn(), deleteServiceRecordDraft: vi.fn(), completeServiceRecord: vi.fn(),
            createServiceRecordSnapshot: vi.fn(), previewServiceRecordPdf: vi.fn(), downloadServiceRecordPdf: vi.fn(),
          }}
          >
            <MemoryRouter initialEntries={['/service-records/record-1/edit']}>
              <Routes>
                <Route path="/service-records/:serviceRecordId/edit" element={<ServiceRecordEditor mode="edit" />} />
                <Route path="/service-records/:serviceRecordId" element={<p>Review route</p>} />
              </Routes>
            </MemoryRouter>
          </ServiceRecordProvider>
        </VehicleProvider>
      </AuthenticationContext.Provider>
    </QueryClientProvider>,
  );
  return { saveServiceRecordDraft };
}

function renderNewEditor() {
  const createdDraft: ServiceRecord = {
    ...draft,
    id: 'created-record',
    serviceDate: '2026-07-23',
    odometer: 12345,
  };
  const createServiceRecordDraft = vi.fn<ServiceRecordOperations['createServiceRecordDraft']>((input) => Promise.resolve({
    ok: true,
    value: {
      ...createdDraft,
      serviceDate: input.serviceDate,
      odometer: input.odometer,
    },
  } as const));
  const saveServiceRecordDraft = vi.fn<ServiceRecordOperations['saveServiceRecordDraft']>((id, _expectedVersion, nextDraft) => Promise.resolve({
    ok: true,
    value: {
      ...createdDraft,
      id,
      ...nextDraft,
      version: 2,
      updatedAt: '2026-07-23T00:01:00.000Z',
    },
  } as const));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <AuthenticationContext.Provider value={{ completeAuthenticationRedirect: vi.fn(), registerPrivateStateCleanup: vi.fn(() => vi.fn()), restoreAuthentication: vi.fn(), signInWithGoogle: vi.fn(), signOut: vi.fn(), state: { status: 'authenticated', user: { id: 'owner-1', role: 'admin', displayName: 'Admin', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' } } }}>
        <VehicleProvider operations={{
          createVehicle: vi.fn(), updateVehicle: vi.fn(), getVehicle: vi.fn(() => Promise.resolve({ ok: true, value: { ...vehicle, currentOdometer: 12345 } } as const)),
          listActiveVehicles: vi.fn(), listArchivedVehicles: vi.fn(), archiveVehicle: vi.fn(), restoreVehicle: vi.fn(), deleteVehicle: vi.fn(),
        }}
        >
          <ServiceRecordProvider operations={{
            getServiceRecord: vi.fn(), listServiceRecordsForVehicle: vi.fn(() => Promise.resolve({ ok: true, value: [] } as const)),
            saveServiceRecordDraft, createServiceRecordDraft, deleteServiceRecordDraft: vi.fn(), completeServiceRecord: vi.fn(),
            createServiceRecordSnapshot: vi.fn(), previewServiceRecordPdf: vi.fn(), downloadServiceRecordPdf: vi.fn(),
          }}
          >
            <MemoryRouter initialEntries={['/vehicles/vehicle-1/service-records/new']}>
              <Routes>
                <Route path="/vehicles/:vehicleId/service-records/new" element={<ServiceRecordEditor mode="new" />} />
                <Route path="/service-records/:serviceRecordId" element={<p>Review route</p>} />
              </Routes>
            </MemoryRouter>
          </ServiceRecordProvider>
        </VehicleProvider>
      </AuthenticationContext.Provider>
    </QueryClientProvider>,
  );
  return { createServiceRecordDraft, saveServiceRecordDraft };
}

describe('ServiceRecordEditor', () => {
  it('opens the new Service Record route with the complete editor and persists it in one save', async () => {
    const user = userEvent.setup();
    const { createServiceRecordDraft, saveServiceRecordDraft } = renderNewEditor();

    await screen.findByRole('heading', { name: 'New Service Record' });
    for (const heading of ['Vehicle and Service Details', 'Work Performed', 'Parts & Consumables', 'Inspections and Recommendations', 'Next Service Due', 'Notes']) {
      expect(screen.getByRole('heading', { name: heading })).toBeVisible();
    }
    expect(screen.queryByRole('button', { name: 'Create draft' })).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('Summary'), 'Annual service');
    await user.click(screen.getByRole('button', { name: 'Add work' }));
    await user.type(screen.getByLabelText('Item 1 name'), 'Road test');
    await user.click(screen.getByRole('button', { name: 'Save draft' }));

    expect(createServiceRecordDraft).toHaveBeenCalledWith(expect.objectContaining({ vehicleId: 'vehicle-1', odometer: 12345 }));
    expect(saveServiceRecordDraft).toHaveBeenCalledWith('created-record', 1, expect.objectContaining({
      summary: 'Annual service',
      items: [expect.objectContaining({ name: 'Road test', sortOrder: 0 })],
    }));
    expect(await screen.findByText('Review route')).toBeVisible();
  });

  it('exposes six maintenance sections, adapts material costs, reorders items, and saves the derived aggregate', async () => {
    const user = userEvent.setup();
    const { saveServiceRecordDraft } = renderEditor();

    await screen.findByRole('heading', { name: 'Edit Service Record' });
    for (const heading of ['Vehicle and Service Details', 'Work Performed', 'Parts & Consumables', 'Inspections and Recommendations', 'Next Service Due', 'Notes']) {
      expect(screen.getByRole('heading', { name: heading })).toBeVisible();
    }
    await user.click(screen.getByRole('button', { name: 'Add part' }));
    await user.type(screen.getByLabelText('Item 1 name'), 'Oil filter');
    await user.type(screen.getByLabelText('Item 1 Purchase Cost (AUD)'), '72.99');
    expect(screen.getByText(/Total Parts & Consumables:/)).toHaveTextContent('$72.99');
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(saveServiceRecordDraft).toHaveBeenCalledWith('record-1', 1, expect.objectContaining({ items: [expect.objectContaining({ name: 'Oil filter', sortOrder: 0 })] }));
    expect(saveServiceRecordDraft.mock.calls[0]?.[2].items[0]?.id).toMatch(uuidPattern);
    expect(await screen.findByText('Review route')).toBeVisible();
  });

  it('keeps item kinds within their maintenance section and offers Other explicitly', async () => {
    const user = userEvent.setup();
    renderEditor();

    await screen.findByRole('heading', { name: 'Edit Service Record' });
    await user.click(screen.getByRole('button', { name: 'Add work' }));
    expect(screen.getByLabelText('Item 1 name')).toBeVisible();
    expect(screen.queryByLabelText('Item 1 kind')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add other' }));
    expect(screen.getByLabelText('Item 2 name')).toBeVisible();
  });

  it('keeps labelled item controls operable after reordering and removing an item', async () => {
    const user = userEvent.setup();
    renderEditor();

    await screen.findByRole('heading', { name: 'Edit Service Record' });
    await user.click(screen.getByRole('button', { name: 'Add work' }));
    await user.type(screen.getByLabelText('Item 1 name'), 'Inspect brakes');
    await user.click(screen.getByRole('button', { name: 'Add work' }));
    await user.type(screen.getByLabelText('Item 2 name'), 'Road test');

    await user.click(screen.getByRole('button', { name: 'Move item 2 up' }));
    expect(screen.getByLabelText('Item 1 name')).toHaveValue('Road test');
    expect(screen.getByRole('button', { name: 'Remove item 2' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Remove item 2' }));
    expect(screen.queryByLabelText('Item 2 name')).not.toBeInTheDocument();
  });

  it('adds and focuses a same-section item when Enter is pressed in an item field', async () => {
    const user = userEvent.setup();
    const { saveServiceRecordDraft } = renderEditor();

    await screen.findByRole('heading', { name: 'Edit Service Record' });
    await user.click(screen.getByRole('button', { name: 'Add part' }));
    await user.click(screen.getByLabelText('Item 1 name'));
    await user.keyboard('{Enter}');

    expect(screen.getByLabelText('Item 2 name')).toHaveFocus();
    expect(saveServiceRecordDraft).not.toHaveBeenCalled();
  });

  it('adds a same-section item instead of saving when Enter is pressed in another item field', async () => {
    const user = userEvent.setup();
    const { saveServiceRecordDraft } = renderEditor();

    await screen.findByRole('heading', { name: 'Edit Service Record' });
    await user.click(screen.getByRole('button', { name: 'Add part' }));
    await user.type(screen.getByLabelText('Item 1 name'), 'Oil filter');
    await user.click(screen.getByLabelText('Item 1 Purchase Cost (AUD)'));
    await user.keyboard('{Enter}');

    expect(screen.getByLabelText('Item 2 name')).toHaveFocus();
    expect(saveServiceRecordDraft).not.toHaveBeenCalled();
  });

  it('does not save the draft from implicit Enter submits in service fields', async () => {
    const user = userEvent.setup();
    const { saveServiceRecordDraft } = renderEditor();

    await screen.findByRole('heading', { name: 'Edit Service Record' });
    await user.click(screen.getByLabelText('Summary'));
    await user.keyboard('{Enter}');

    expect(saveServiceRecordDraft).not.toHaveBeenCalled();
  });

  it('highlights invalid draft fields before save', async () => {
    const user = userEvent.setup();
    renderEditor();

    await screen.findByRole('heading', { name: 'Edit Service Record' });
    await user.click(screen.getByRole('button', { name: 'Add work' }));

    expect(screen.getByLabelText('Item 1 name')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled();
  });
});
