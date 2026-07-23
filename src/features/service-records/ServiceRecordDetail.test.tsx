import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AuthenticationContext } from '../../app/providers/authenticationContext';
import type { ServiceRecord, ServiceRecordSnapshot } from '../../domain/service-records/serviceRecord';
import { ServiceRecordProvider } from './ServiceRecordProvider';
import { ServiceRecordDetail } from './ServiceRecordDetail';
import type { ServiceRecordOperations } from './serviceRecordContext';

const completed: ServiceRecord = {
  id: 'record-1', ownerId: 'owner-1', vehicleId: 'vehicle-1', displayNumber: 'SR-000001', status: 'completed',
  serviceDate: '2026-07-20', odometer: 12000, summary: 'Annual maintenance', currencyCode: 'AUD', items: [], version: 2,
  createdAt: '2026-07-20T00:00:00.000Z', updatedAt: '2026-07-20T00:00:00.000Z', completedAt: '2026-07-20T04:00:00.000Z',
};
const draft: ServiceRecord = {
  id: 'record-1', ownerId: 'owner-1', vehicleId: 'vehicle-1', status: 'draft', serviceDate: '2026-07-20',
  odometer: 12000, summary: 'Annual maintenance', currencyCode: 'AUD', items: [], version: 1,
  createdAt: '2026-07-20T00:00:00.000Z', updatedAt: '2026-07-20T00:00:00.000Z',
};
const draftWithItems: ServiceRecord = {
  ...draft,
  items: [
    { id: 'item-1', kind: 'work', name: 'Front Differential Oil Flush', notes: 'Looks normal', sortOrder: 0 },
    { id: 'item-2', kind: 'fluid', name: 'Penrite Gear Oil 80W90', partNumber: 'GO8090004', purchaseCostMinor: 5999, sortOrder: 1 },
    { id: 'item-3', kind: 'inspection', name: 'Oil leaking from engine', sortOrder: 2 },
  ],
};
const snapshot: ServiceRecordSnapshot = {
  id: 'snapshot-1', schemaVersion: 1, templateVersion: 1, brandingVersion: 1, serviceRecordId: completed.id,
  displayNumber: 'SR-000001', status: 'completed', serviceRecordVersion: 2, serviceDate: completed.serviceDate,
  generatedAt: '2026-07-22T00:00:00.000Z', createdById: 'owner-1', vehicle: { make: 'Ferrari', model: 'Roma', odometerUnit: 'km' },
  odometer: completed.odometer, currencyCode: 'AUD', items: [], totalPurchaseCostMinor: 0,
};

function operations(record: ServiceRecord): ServiceRecordOperations {
  return {
    completeServiceRecord: vi.fn(() => Promise.resolve({ ok: true, value: completed } as const)),
    createServiceRecordDraft: vi.fn(), createServiceRecordSnapshot: vi.fn(), deleteServiceRecordDraft: vi.fn(),
    downloadServiceRecordPdf: vi.fn(), getServiceRecord: vi.fn(() => Promise.resolve({ ok: true, value: record } as const)),
    listServiceRecordsForVehicle: vi.fn(), previewServiceRecordPdf: vi.fn(() => Promise.resolve({ ok: true, value: { snapshot, pdf: new Blob(['fresh']) } } as const)), saveServiceRecordDraft: vi.fn(),
    listServiceRecordSnapshots: vi.fn(() => Promise.resolve({ ok: true, value: [{ id: snapshot.id, serviceRecordId: completed.id, displayNumber: 'SR-000001', serviceRecordVersion: 2, schemaVersion: 1, templateVersion: 1, brandingVersion: 1, generatedAt: snapshot.generatedAt }] } as const)),
    previewHistoricalServiceRecordPdf: vi.fn(() => Promise.resolve({ ok: true, value: { snapshot, pdf: new Blob(['historical']) } } as const)),
  };
}

function renderDetail(record: ServiceRecord) {
  const serviceRecordOperations = operations(record);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <AuthenticationContext.Provider value={{ completeAuthenticationRedirect: vi.fn(), registerPrivateStateCleanup: vi.fn(() => vi.fn()), restoreAuthentication: vi.fn(), signInWithGoogle: vi.fn(), signOut: vi.fn(), state: { status: 'authenticated', user: { id: 'owner-1', role: 'admin', displayName: 'Admin', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' } } }}>
        <ServiceRecordProvider operations={serviceRecordOperations}>
          <MemoryRouter initialEntries={['/service-records/record-1']}>
            <Routes>
              <Route element={<ServiceRecordDetail />} path="/service-records/:serviceRecordId" />
              <Route element={<p>Edit draft route</p>} path="/service-records/:serviceRecordId/edit" />
            </Routes>
          </MemoryRouter>
        </ServiceRecordProvider>
      </AuthenticationContext.Provider>
    </QueryClientProvider>,
  );
  return serviceRecordOperations;
}

describe('ServiceRecordDetail', () => {
  it('shows an edit action for draft Service Records', async () => {
    const user = userEvent.setup();
    renderDetail(draft);

    const editLink = await screen.findByRole('link', { name: 'Edit draft' });
    expect(editLink).toHaveAttribute('href', '/service-records/record-1/edit');
    await user.click(editLink);
    expect(await screen.findByText('Edit draft route')).toBeVisible();
  });

  it('does not show an edit action for completed Service Records', async () => {
    renderDetail(completed);

    await screen.findByRole('heading', { name: 'PDF export' });
    expect(screen.queryByRole('link', { name: 'Edit draft' })).not.toBeInTheDocument();
  });

  it('requires an explicit confirmation before completing a draft', async () => {
    const user = userEvent.setup();
    const serviceRecordOperations = renderDetail(draft);

    expect(await screen.findByRole('heading', { name: 'Completion review' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Complete Service Record' })).toBeDisabled();
    await user.click(screen.getByRole('checkbox', { name: 'I understand this Service Record will become read-only and cannot be changed.' }));
    await user.click(screen.getByRole('button', { name: 'Complete Service Record' }));
    expect(serviceRecordOperations.completeServiceRecord).toHaveBeenCalledWith('record-1', 1);
  });

  it('shows saved work, consumables, and inspections in draft review', async () => {
    renderDetail(draftWithItems);

    expect(await screen.findByRole('heading', { name: 'Completion review' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Front Differential Oil Flush' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Penrite Gear Oil 80W90' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Oil leaking from engine' })).toBeVisible();
    expect(screen.getByText('$59.99')).toBeVisible();
  });

  it('keeps fresh exports separate from an explicitly selected historical export', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:preview'), revokeObjectURL: vi.fn() });
    const serviceRecordOperations = renderDetail(completed);

    await screen.findByRole('heading', { name: 'PDF export' });
    await user.click(screen.getByRole('button', { name: 'Preview fresh PDF' }));
    expect(serviceRecordOperations.previewServiceRecordPdf).toHaveBeenCalledWith('record-1');
    expect(await screen.findByTitle('Service Record PDF preview')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Preview this historical export' }));
    expect(serviceRecordOperations.previewHistoricalServiceRecordPdf).toHaveBeenCalledWith('record-1', 'snapshot-1');
    vi.unstubAllGlobals();
  });
});
