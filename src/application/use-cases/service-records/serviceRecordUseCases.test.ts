import { describe, expect, it, vi, type Mock } from 'vitest';
import type { AppUser } from '../../../domain/users/appUser';
import type {
  ServiceRecord,
  ServiceRecordDraftInput,
  ServiceRecordSnapshot,
} from '../../../domain/service-records/serviceRecord';
import type { Vehicle } from '../../../domain/vehicles/vehicle';
import type { ServiceRecordPdfRenderer } from '../../ports/serviceRecordPdfRenderer';
import type { ServiceRecordRepository } from '../../ports/serviceRecordRepository';
import type { ServiceRecordSnapshotRepository } from '../../ports/serviceRecordSnapshotRepository';
import type { VehicleRepository } from '../../ports/vehicleRepository';
import {
  createServiceRecordError,
  type ServiceRecordErrorCategory,
  type ServiceRecordResult,
} from '../../service-records/serviceRecordResult';
import {
  ServiceRecordUseCases,
  type CurrentAppUserSource,
  type ServiceRecordSnapshotSource,
} from './serviceRecordUseCases';

type MockRepository<T> = {
  [Method in keyof T]: Mock<Extract<T[Method], (...args: never[]) => unknown>>;
};
type SnapshotCommand = Parameters<ServiceRecordUseCases['createServiceRecordSnapshot']>[0];
type PreviewCommand = Parameters<ServiceRecordUseCases['previewServiceRecordPdf']>[0];
type DownloadCommand = Parameters<ServiceRecordUseCases['downloadServiceRecordPdf']>[0];
type ProtectedInput = 'ownerId' | 'displayNumber' | 'createdAt' | 'updatedAt' | 'completedAt' | 'generatedAt' | 'createdById';
type Expect<T extends true> = T;
type IsNever<T> = [T] extends [never] ? true : false;

const snapshotCommandsExcludeProtectedValues: Expect<
  IsNever<Extract<keyof SnapshotCommand, ProtectedInput>>
> = true;
const previewCommandsExcludeProtectedValues: Expect<
  IsNever<Extract<keyof PreviewCommand, ProtectedInput>>
> = true;
const downloadCommandsExcludeProtectedValues: Expect<
  IsNever<Extract<keyof DownloadCommand, ProtectedInput>>
> = true;

const admin: AppUser = {
  id: 'admin-1',
  displayName: 'Garage Admin',
  role: 'admin',
  createdAt: '2026-07-20T00:00:00.000Z',
  updatedAt: '2026-07-20T00:00:00.000Z',
};

const member: AppUser = { ...admin, id: 'member-1', role: 'member' };

const vehicle: Vehicle = {
  id: 'vehicle-1',
  ownerId: admin.id,
  make: 'Ferrari',
  model: 'Roma',
  year: '2021',
  registration: 'PRIVATE 1',
  registrationState: 'WA',
  vin: 'PRIVATE-VIN',
  engine: '3.9L V8',
  odometerUnit: 'km',
  createdAt: '2026-07-20T00:00:00.000Z',
  updatedAt: '2026-07-20T00:00:00.000Z',
};

const draft: ServiceRecord = {
  id: 'record-1',
  ownerId: admin.id,
  vehicleId: vehicle.id,
  status: 'draft',
  serviceDate: '2026-07-22',
  odometer: 12_500,
  performedBy: admin.displayName,
  summary: 'Engine oil service',
  currencyCode: 'AUD',
  items: [],
  version: 1,
  createdAt: '2026-07-22T00:00:00.000Z',
  updatedAt: '2026-07-22T00:00:00.000Z',
};

const completed: ServiceRecord = {
  ...draft,
  status: 'completed',
  displayNumber: 'SR-000001',
  summary: 'Engine oil service',
  version: 2,
  completedAt: '2026-07-22T01:00:00.000Z',
};

const validDraft: ServiceRecordDraftInput = {
  serviceDate: draft.serviceDate,
  odometer: draft.odometer,
  summary: 'Engine oil service',
  items: [],
};

function success<T>(value: T): ServiceRecordResult<T> {
  return { ok: true, value };
}

function failure<T>(category: Exclude<ServiceRecordErrorCategory, 'validation'>): ServiceRecordResult<T> {
  return { ok: false, error: createServiceRecordError(category) };
}

function createRepositories(): {
  readonly records: MockRepository<ServiceRecordRepository>;
  readonly vehicles: MockRepository<VehicleRepository>;
  readonly snapshots: MockRepository<ServiceRecordSnapshotRepository>;
  readonly renderer: MockRepository<ServiceRecordPdfRenderer>;
} {
  return {
    records: {
      getById: vi.fn().mockResolvedValue(success(draft)),
      listForVehicle: vi.fn().mockResolvedValue(success([])),
      createDraft: vi.fn().mockResolvedValue(success(draft)),
      saveDraft: vi.fn().mockResolvedValue(success(draft)),
      deleteDraft: vi.fn().mockResolvedValue(success(undefined)),
      complete: vi.fn().mockResolvedValue(success(completed)),
    },
    vehicles: {
      listActive: vi.fn(), listArchived: vi.fn(), getById: vi.fn().mockResolvedValue({ ok: true, value: vehicle }),
      create: vi.fn(), update: vi.fn(), archive: vi.fn(), restore: vi.fn(), delete: vi.fn(), findDuplicate: vi.fn(),
    },
    snapshots: { getById: vi.fn(), listForRecord: vi.fn(), save: vi.fn().mockImplementation((value: ServiceRecordSnapshot) => Promise.resolve(success(value))) },
    renderer: { render: vi.fn().mockResolvedValue(success(new Blob(['pdf']))) },
  };
}

function createSubject(
  repositories = createRepositories(),
  currentUser: AppUser | null = admin,
): { readonly subject: ServiceRecordUseCases; readonly repositories: typeof repositories } {
  const currentUserSource: CurrentAppUserSource = { getCurrentAppUser: () => currentUser };
  const snapshotSource: ServiceRecordSnapshotSource = {
    createId: () => 'snapshot-2',
    now: () => '2026-07-22T02:00:00.000Z',
  };
  return {
    subject: new ServiceRecordUseCases(
      repositories.records, repositories.vehicles, repositories.snapshots, repositories.renderer,
      currentUserSource, snapshotSource,
    ),
    repositories,
  };
}

describe('ServiceRecordUseCases authorization', () => {
  it.each([['missing', null], ['member', member]])('denies every workflow for a %s identity', async (_, user) => {
    const { subject, repositories } = createSubject(createRepositories(), user);
    const results = await Promise.all([
      subject.createServiceRecordDraft({ vehicleId: vehicle.id, serviceDate: draft.serviceDate, odometer: draft.odometer }),
      subject.listServiceRecordsForVehicle(vehicle.id), subject.getServiceRecord(draft.id),
      subject.saveServiceRecordDraft(draft.id, 1, validDraft), subject.deleteServiceRecordDraft(draft.id, 1),
      subject.completeServiceRecord(draft.id, 1), subject.createServiceRecordSnapshot(completed.id),
      subject.previewServiceRecordPdf(completed.id), subject.downloadServiceRecordPdf(completed.id),
    ]);
    expect(results).toEqual(Array.from({ length: 9 }, () => failure('unauthorized')));
    for (const repository of Object.values(repositories)) {
      for (const method of Object.values(repository)) {
        expect(method).not.toHaveBeenCalled();
      }
    }
  });

  it('fails closed when authentication lookup throws', async () => {
    const repositories = createRepositories();
    const source: CurrentAppUserSource = {
      getCurrentAppUser: () => {
        throw new Error('private auth detail');
      },
    };
    const subject = new ServiceRecordUseCases(repositories.records, repositories.vehicles, repositories.snapshots, repositories.renderer, source, { createId: () => 'snapshot-2', now: () => '2026-07-22T02:00:00.000Z' });
    await expect(subject.getServiceRecord(draft.id)).resolves.toEqual(failure('unauthorized'));
    expect(repositories.records.getById).not.toHaveBeenCalled();
  });

  it('does not expose protected source values in snapshot commands', () => {
    expect([snapshotCommandsExcludeProtectedValues, previewCommandsExcludeProtectedValues, downloadCommandsExcludeProtectedValues]).toEqual([true, true, true]);
  });
});

describe('ServiceRecordUseCases workflows', () => {
  it('creates, lists, gets, saves, deletes, and completes records through the app-owned repository', async () => {
    const { subject, repositories } = createSubject();
    await expect(subject.createServiceRecordDraft({ vehicleId: vehicle.id, serviceDate: draft.serviceDate, odometer: draft.odometer })).resolves.toEqual(success(draft));
    await expect(subject.listServiceRecordsForVehicle(vehicle.id)).resolves.toEqual(success([]));
    await expect(subject.getServiceRecord(draft.id)).resolves.toEqual(success(draft));
    await expect(subject.saveServiceRecordDraft(draft.id, 1, validDraft)).resolves.toEqual(success(draft));
    await expect(subject.deleteServiceRecordDraft(draft.id, 1)).resolves.toEqual(success(undefined));
    await expect(subject.completeServiceRecord(draft.id, 1)).resolves.toEqual(success(completed));
    expect(repositories.records.createDraft).toHaveBeenCalledWith({ vehicleId: vehicle.id, serviceDate: draft.serviceDate, odometer: draft.odometer });
    expect(repositories.records.saveDraft).toHaveBeenCalledWith({ id: draft.id, expectedVersion: 1, draft: validDraft });
    expect(repositories.records.deleteDraft).toHaveBeenCalledWith(draft.id, 1);
    expect(repositories.records.complete).toHaveBeenCalledWith(draft.id, 1);
  });

  it('returns app-owned validation errors without calling the repository', async () => {
    const { subject, repositories } = createSubject();
    const result = await subject.saveServiceRecordDraft(draft.id, 1, { ...validDraft, serviceDate: '2026-02-30' });
    expect(result).toMatchObject({ ok: false, error: { category: 'validation' } });
    expect(repositories.records.saveDraft).not.toHaveBeenCalled();
  });

  it('maps absent records to a safe not-found result', async () => {
    const { subject, repositories } = createSubject();
    repositories.records.getById.mockResolvedValue(success(null));
    await expect(subject.getServiceRecord(draft.id)).resolves.toEqual(failure('not_found'));
  });

  it('preserves repository concurrency and maps thrown provider failures safely', async () => {
    const { subject, repositories } = createSubject();
    repositories.records.saveDraft.mockResolvedValue(failure('version_conflict'));
    await expect(subject.saveServiceRecordDraft(draft.id, 7, validDraft)).resolves.toEqual(failure('version_conflict'));
    expect(repositories.records.saveDraft).toHaveBeenCalledWith({ id: draft.id, expectedVersion: 7, draft: validDraft });
    repositories.records.getById.mockRejectedValue(new Error('provider table detail'));
    await expect(subject.getServiceRecord(draft.id)).resolves.toEqual(failure('temporary_failure'));
  });

  it('builds a fresh completed-record snapshot from current vehicle data and current admin identity', async () => {
    const { subject, repositories } = createSubject();
    repositories.records.getById.mockResolvedValue(success(completed));
    const result = await subject.createServiceRecordSnapshot(completed.id);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toMatchObject({
        id: 'snapshot-2',
        createdById: admin.id,
        displayNumber: 'SR-000001',
        vehicle: { vin: vehicle.vin },
      });
    }
    expect(repositories.vehicles.getById).toHaveBeenCalledWith(vehicle.id);
  });

  it('rejects snapshot creation for drafts and maps vehicle failures without leaking Vehicle errors', async () => {
    const { subject, repositories } = createSubject();
    await expect(subject.createServiceRecordSnapshot(draft.id)).resolves.toEqual(failure('lifecycle_conflict'));
    repositories.records.getById.mockResolvedValue(success(completed));
    repositories.vehicles.getById.mockResolvedValue({ ok: false, error: { category: 'not_found', message: 'Private Vehicle error' } });
    await expect(subject.createServiceRecordSnapshot(completed.id)).resolves.toEqual(failure('not_found'));
  });

  it('previews a fresh snapshot without persisting it', async () => {
    const { subject, repositories } = createSubject();
    repositories.records.getById.mockResolvedValue(success(completed));
    const result = await subject.previewServiceRecordPdf(completed.id);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.snapshot.id).toBe('snapshot-2');
      expect(result.value.pdf).toBeInstanceOf(Blob);
    }
    expect(repositories.snapshots.save).not.toHaveBeenCalled();
    expect(repositories.renderer.render).toHaveBeenCalledWith(expect.objectContaining({ id: 'snapshot-2' }));
  });

  it('persists the exact fresh snapshot before rendering a download', async () => {
    const { subject, repositories } = createSubject();
    repositories.records.getById.mockResolvedValue(success(completed));
    const result = await subject.downloadServiceRecordPdf(completed.id);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.snapshot.id).toBe('snapshot-2');
      expect(result.value.pdf).toBeInstanceOf(Blob);
    }
    const saved = repositories.snapshots.save.mock.calls[0]?.[0];
    expect(repositories.renderer.render).toHaveBeenCalledWith(saved);
  });
});
