import { describe, expect, it } from 'vitest';
import type {
  CreateVehicle,
  Vehicle,
  VehicleId,
} from '../../domain/vehicles/vehicle';
import type { VehicleResult } from '../vehicles/vehicleResult';
import type { VehicleRepository } from './vehicleRepository';

export type VehicleRepositoryContractOperation
  = | 'listActive'
    | 'listArchived'
    | 'getById'
    | 'create'
    | 'update'
    | 'archive'
    | 'restore'
    | 'delete'
    | 'findDuplicate';

export interface VehicleRepositoryContractScenario {
  readonly access?: 'garage_admin' | 'denied';
  readonly empty?: boolean;
  readonly failure?: {
    readonly kind?: 'unexpected' | 'http_not_found' | 'missing_resource';
    readonly operation: VehicleRepositoryContractOperation;
    readonly privateMarker: string;
  };
}

export interface VehicleRepositoryContractFixtures {
  readonly activeVehicle: Vehicle;
  readonly archivedDuplicateVehicle: Vehicle;
  readonly createInput: CreateVehicle;
  readonly createdVehicleId: VehicleId;
}

export interface VehicleRepositoryContractHarness {
  readonly fixtures: VehicleRepositoryContractFixtures;
  readonly repository: VehicleRepository;
}

export type CreateVehicleRepositoryContractHarness = (
  scenario?: VehicleRepositoryContractScenario,
) => VehicleRepositoryContractHarness;

const operations: readonly VehicleRepositoryContractOperation[] = [
  'listActive',
  'listArchived',
  'getById',
  'create',
  'update',
  'archive',
  'restore',
  'delete',
  'findDuplicate',
];

function runOperation(
  harness: VehicleRepositoryContractHarness,
  operation: VehicleRepositoryContractOperation,
): Promise<VehicleResult<unknown>> {
  const { activeVehicle, createInput } = harness.fixtures;
  const { repository } = harness;

  switch (operation) {
    case 'listActive':
      return repository.listActive();
    case 'listArchived':
      return repository.listArchived();
    case 'getById':
      return repository.getById(activeVehicle.id);
    case 'create':
      return repository.create(createInput);
    case 'update':
      return repository.update(activeVehicle.id, {
        ...createInput,
        currentOdometer: 22_000,
        odometerUnit: 'mi',
      });
    case 'archive':
      return repository.archive(activeVehicle.id);
    case 'restore':
      return repository.restore(activeVehicle.id);
    case 'delete':
      return repository.delete(activeVehicle.id);
    case 'findDuplicate':
      return repository.findDuplicate(activeVehicle);
  }
}

function expectSafeError(
  result: VehicleResult<unknown>,
  category: 'unauthorized' | 'temporary_failure',
  privateMarker?: string,
): void {
  expect(result).toMatchObject({
    ok: false,
    error: { category },
  });

  if (result.ok) {
    throw new Error('Expected the Vehicle repository operation to fail.');
  }

  expect(Object.keys(result.error).sort()).toEqual(['category', 'message']);

  for (const rawField of ['cause', 'code', 'details', 'hint', 'payload', 'query']) {
    expect(Object.hasOwn(result.error, rawField)).toBe(false);
  }

  if (privateMarker !== undefined) {
    expect(JSON.stringify(result)).not.toContain(privateMarker);
  }
}

export function describeVehicleRepositoryContract(
  adapterName: string,
  createHarness: CreateVehicleRepositoryContractHarness,
): void {
  describe(`${adapterName} VehicleRepository contract`, () => {
    it('creates, reads, and updates a Vehicle including its current odometer unit', async () => {
      const { fixtures, repository } = createHarness();

      const created = await repository.create(fixtures.createInput);
      expect(created).toMatchObject({
        ok: true,
        value: {
          id: fixtures.createdVehicleId,
          make: fixtures.createInput.make,
          model: fixtures.createInput.model,
          currentOdometer: fixtures.createInput.currentOdometer,
          odometerUnit: 'km',
        },
      });

      await expect(repository.getById(fixtures.createdVehicleId)).resolves
        .toEqual(created);

      const updated = await repository.update(fixtures.createdVehicleId, {
        ...fixtures.createInput,
        currentOdometer: 14_250,
        odometerUnit: 'mi',
      });
      expect(updated).toMatchObject({
        ok: true,
        value: {
          id: fixtures.createdVehicleId,
          currentOdometer: 14_250,
          odometerUnit: 'mi',
        },
      });
      await expect(repository.getById(fixtures.createdVehicleId)).resolves
        .toEqual(updated);
    });

    it('separates active and archived lists while archive and restore change lifecycle', async () => {
      const { fixtures, repository } = createHarness();

      await expect(repository.listActive()).resolves.toMatchObject({
        ok: true,
        value: [{ id: fixtures.activeVehicle.id }],
      });
      await expect(repository.listArchived()).resolves.toMatchObject({
        ok: true,
        value: [{ id: fixtures.archivedDuplicateVehicle.id }],
      });

      const archived = await repository.archive(fixtures.activeVehicle.id);
      expect(archived).toMatchObject({
        ok: true,
        value: { id: fixtures.activeVehicle.id },
      });
      expect(archived.ok && typeof archived.value.archivedAt).toBe('string');
      await expect(repository.listActive()).resolves.toMatchObject({
        ok: true,
        value: [],
      });
      const archivedList = await repository.listArchived();
      expect(archivedList.ok).toBe(true);

      if (!archivedList.ok) {
        throw new Error('Expected the archived Vehicle list to succeed.');
      }

      expect(archivedList.value.map((vehicle) => vehicle.id)).toEqual([
        fixtures.archivedDuplicateVehicle.id,
        fixtures.activeVehicle.id,
      ]);

      await expect(repository.restore(fixtures.activeVehicle.id)).resolves
        .toMatchObject({ ok: true, value: { id: fixtures.activeVehicle.id } });
      const restored = await repository.getById(fixtures.activeVehicle.id);
      expect(restored.ok && restored.value).not.toHaveProperty('archivedAt');
    });

    it('permanently deletes a currently eligible Vehicle', async () => {
      const { fixtures, repository } = createHarness();

      await expect(repository.delete(fixtures.activeVehicle.id)).resolves.toEqual({
        ok: true,
        value: undefined,
      });
      await expect(repository.getById(fixtures.activeVehicle.id)).resolves
        .toMatchObject({ ok: false, error: { category: 'not_found' } });
    });

    it('allows duplicate persistence and finds warnings across all lifecycle states', async () => {
      const { fixtures, repository } = createHarness();
      const duplicateInput: CreateVehicle = {
        ...fixtures.createInput,
        make: ' FERRARI ',
        model: 'ro ma',
        registration: 'test123',
      };

      await expect(repository.findDuplicate(duplicateInput)).resolves.toEqual({
        ok: true,
        value: {
          vehicleId: fixtures.archivedDuplicateVehicle.id,
          label: '2021 Ferrari Roma · TEST 123',
        },
      });
      await expect(repository.findDuplicate(
        duplicateInput,
        fixtures.archivedDuplicateVehicle.id,
      )).resolves.toEqual({
        ok: true,
        value: {
          vehicleId: fixtures.activeVehicle.id,
          label: '2021 Ferrari Roma · TEST 123',
        },
      });

      const savedDuplicate = await repository.create(duplicateInput);
      expect(savedDuplicate).toMatchObject({
        ok: true,
        value: { id: fixtures.createdVehicleId },
      });
    });

    it.each([
      'getById',
      'update',
      'archive',
      'restore',
      'delete',
    ] as const)('returns not found when %s targets a missing Vehicle', async (operation) => {
      const harness = createHarness({ empty: true });

      await expect(runOperation(harness, operation)).resolves.toMatchObject({
        ok: false,
        error: { category: 'not_found' },
      });
    });

    it.each(operations)(
      'allows only the harness Garage Admin to perform %s',
      async (operation) => {
        const harness = createHarness({ access: 'denied' });
        const result = await runOperation(harness, operation);

        expectSafeError(result, 'unauthorized');
      },
    );

    it.each(operations)(
      'maps an unexpected %s failure without leaking adapter or private details',
      async (operation) => {
        const privateMarker = `synthetic-private-${operation}`;
        const harness = createHarness({
          failure: { operation, privateMarker },
        });
        const result = await runOperation(harness, operation);

        expectSafeError(result, 'temporary_failure', privateMarker);
      },
    );

    it.each(operations)(
      'maps a generic HTTP 404 from %s to a safe temporary failure',
      async (operation) => {
        const privateMarker = `synthetic-private-404-${operation}`;
        const harness = createHarness({
          failure: { kind: 'http_not_found', operation, privateMarker },
        });
        const result = await runOperation(harness, operation);

        expectSafeError(result, 'temporary_failure', privateMarker);
      },
    );

    it.each(operations)(
      'maps a missing provider resource for %s to a safe temporary failure',
      async (operation) => {
        const privateMarker = `synthetic-private-missing-resource-${operation}`;
        const harness = createHarness({
          failure: { kind: 'missing_resource', operation, privateMarker },
        });
        const result = await runOperation(harness, operation);

        expectSafeError(result, 'temporary_failure', privateMarker);
      },
    );
  });
}
