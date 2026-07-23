import { describe, expect, it } from 'vitest';
import type {
  ServiceRecordDraftInput,
  ServiceRecordId,
  ServiceRecordSnapshot,
} from '../../domain/service-records/serviceRecord';
import type { VehicleId } from '../../domain/vehicles/vehicle';
import type { ServiceRecordResult } from '../service-records/serviceRecordResult';
import type { ServiceRecordRepository } from './serviceRecordRepository';
import type { ServiceRecordSnapshotRepository } from './serviceRecordSnapshotRepository';

export interface ServiceRecordRepositoryContractFixtures {
  readonly vehicleId: VehicleId;
  readonly recordId: ServiceRecordId;
  readonly createDraft: {
    readonly vehicleId: VehicleId;
    readonly serviceDate: string;
    readonly odometer: number;
  };
  readonly completeDraft: ServiceRecordDraftInput;
  readonly snapshot: ServiceRecordSnapshot;
}

export interface ServiceRecordRepositoryContractScenario {
  readonly access?: 'garage_admin' | 'denied';
  readonly vehicle?: 'active' | 'archived';
}

export interface ServiceRecordRepositoryContractHarness {
  readonly fixtures: ServiceRecordRepositoryContractFixtures;
  readonly records: ServiceRecordRepository;
  readonly snapshots: ServiceRecordSnapshotRepository;
}

export type CreateServiceRecordRepositoryContractHarness = (
  scenario?: ServiceRecordRepositoryContractScenario,
) => ServiceRecordRepositoryContractHarness;

function expectError<T>(
  result: ServiceRecordResult<T>,
  category: 'unauthorized' | 'version_conflict' | 'lifecycle_conflict',
): void {
  expect(result).toMatchObject({ ok: false, error: { category } });

  if (result.ok) {
    throw new Error('Expected Service Record repository operation to fail.');
  }

  expect(Object.keys(result.error).sort()).toEqual(
    result.error.category === 'validation'
      ? ['category', 'issues', 'message']
      : ['category', 'message'],
  );
}

export function describeServiceRecordRepositoryContract(
  adapterName: string,
  createHarness: CreateServiceRecordRepositoryContractHarness,
): void {
  describe(`${adapterName} Service Record repository contract`, () => {
    it('saves a complete ordered aggregate atomically and advances its version', async () => {
      const { fixtures, records } = createHarness();
      const created = await records.createDraft(fixtures.createDraft);
      expect(created).toMatchObject({
        ok: true,
        value: { id: fixtures.recordId, status: 'draft', version: 1, items: [] },
      });

      const saved = await records.saveDraft({
        id: fixtures.recordId,
        expectedVersion: 1,
        draft: fixtures.completeDraft,
      });
      expect(saved).toMatchObject({
        ok: true,
        value: { id: fixtures.recordId, status: 'draft', version: 2 },
      });
      expect(saved.ok && saved.value.items.map((item) => item.sortOrder)).toEqual([0, 1]);

      const loaded = await records.getById(fixtures.recordId);
      expect(loaded).toEqual(saved);
      const listed = await records.listForVehicle(fixtures.vehicleId);
      expect(listed).toMatchObject({
        ok: true,
        value: [{
          id: fixtures.recordId,
          totalPurchaseCostMinor: 6_500,
          version: 2,
        }],
      });
    });

    it('enforces optimistic versions and completion retry while preserving completed aggregates', async () => {
      const { fixtures, records } = createHarness();
      await records.createDraft(fixtures.createDraft);
      await records.saveDraft({
        id: fixtures.recordId,
        expectedVersion: 1,
        draft: fixtures.completeDraft,
      });

      expectError(await records.saveDraft({
        id: fixtures.recordId,
        expectedVersion: 1,
        draft: fixtures.completeDraft,
      }), 'version_conflict');

      const completed = await records.complete(fixtures.recordId, 2);
      expect(completed).toMatchObject({
        ok: true,
        value: {
          id: fixtures.recordId,
          status: 'completed',
          displayNumber: 'SR-000001',
          version: 3,
        },
      });
      await expect(records.complete(fixtures.recordId, 2)).resolves.toEqual(completed);
      expectError(await records.complete(fixtures.recordId, 1), 'version_conflict');
      expectError(await records.saveDraft({
        id: fixtures.recordId,
        expectedVersion: 3,
        draft: fixtures.completeDraft,
      }), 'lifecycle_conflict');
      expectError(await records.deleteDraft(fixtures.recordId, 3), 'lifecycle_conflict');
    });

    it('keeps completed history readable while archived Vehicles reject new drafts', async () => {
      const { fixtures, records } = createHarness({ vehicle: 'archived' });
      await expect(records.getById(fixtures.recordId)).resolves.toMatchObject({
        ok: true,
        value: { status: 'completed' },
      });
      await expect(records.listForVehicle(fixtures.vehicleId)).resolves.toMatchObject({
        ok: true,
        value: [{ id: fixtures.recordId, status: 'completed' }],
      });
      expectError(await records.createDraft(fixtures.createDraft), 'lifecycle_conflict');
    });

    it('persists and retrieves immutable completed-record snapshots', async () => {
      const { fixtures, snapshots } = createHarness({ vehicle: 'archived' });
      await expect(snapshots.save(fixtures.snapshot)).resolves.toEqual({
        ok: true,
        value: fixtures.snapshot,
      });
      await expect(snapshots.getById(fixtures.snapshot.id)).resolves.toEqual({
        ok: true,
        value: fixtures.snapshot,
      });
      await expect(snapshots.listForRecord(fixtures.recordId)).resolves.toMatchObject({
        ok: true,
        value: [{
          id: fixtures.snapshot.id,
          serviceRecordId: fixtures.recordId,
          serviceRecordVersion: 3,
        }],
      });
    });

    it('maps denied provider access to app-owned errors for both repositories', async () => {
      const { fixtures, records, snapshots } = createHarness({ access: 'denied' });
      expectError(await records.getById(fixtures.recordId), 'unauthorized');
      expectError(await records.listForVehicle(fixtures.vehicleId), 'unauthorized');
      expectError(await records.createDraft(fixtures.createDraft), 'unauthorized');
      expectError(await records.saveDraft({
        id: fixtures.recordId,
        expectedVersion: 1,
        draft: fixtures.completeDraft,
      }), 'unauthorized');
      expectError(await records.deleteDraft(fixtures.recordId, 1), 'unauthorized');
      expectError(await records.complete(fixtures.recordId, 1), 'unauthorized');
      expectError(await snapshots.getById(fixtures.snapshot.id), 'unauthorized');
      expectError(await snapshots.listForRecord(fixtures.recordId), 'unauthorized');
      expectError(await snapshots.save(fixtures.snapshot), 'unauthorized');
    });
  });
}
