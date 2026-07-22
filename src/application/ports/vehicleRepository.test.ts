import { describe, expect, it } from 'vitest';
import type {
  CreateVehicle,
  UpdateVehicle,
  Vehicle,
  VehicleDuplicateCandidate,
  VehicleId,
  VehicleSummary,
} from '../../domain/vehicles/vehicle';
import type { VehicleResult } from '../vehicles/vehicleResult';
import type {
  VehicleDuplicateWarning,
  VehicleRepository,
} from './vehicleRepository';

type Expect<T extends true> = T;
type IsNever<T> = [T] extends [never] ? true : false;

type ForbiddenCommandField
  = | 'ownerId'
    | 'role'
    | 'archivedAt'
    | 'createdAt'
    | 'updatedAt'
    | 'filter'
    | 'table'
    | 'query';

type CreateCommand = Parameters<VehicleRepository['create']>[0];
type UpdateCommand = Parameters<VehicleRepository['update']>[1];
type DuplicateCommand = Parameters<VehicleRepository['findDuplicate']>[0];

const createUsesOnlyPermittedFields: Expect<
  IsNever<Extract<keyof CreateCommand, ForbiddenCommandField>>
> = true;
const updateUsesOnlyPermittedFields: Expect<
  IsNever<Extract<keyof UpdateCommand, ForbiddenCommandField>>
> = true;
const duplicateUsesOnlyPermittedFields: Expect<
  IsNever<Extract<keyof DuplicateCommand, ForbiddenCommandField>>
> = true;

const vehicle: Vehicle = {
  id: 'vehicle-1',
  ownerId: 'app-user-1',
  make: 'Ferrari',
  model: 'Roma',
  year: '2021',
  registration: 'TEST 123',
  registrationState: 'WA',
  currentOdometer: 12_500,
  odometerUnit: 'km',
  createdAt: '2026-07-20T00:00:00.000Z',
  updatedAt: '2026-07-20T00:00:00.000Z',
};

const summary: VehicleSummary = vehicle;

function success<T>(value: T): VehicleResult<T> {
  return { ok: true, value };
}

class RecordingVehicleRepository implements VehicleRepository {
  public readonly calls: string[] = [];

  public listActive(): Promise<VehicleResult<readonly VehicleSummary[]>> {
    this.calls.push('listActive');
    return Promise.resolve(success([summary]));
  }

  public listArchived(): Promise<VehicleResult<readonly VehicleSummary[]>> {
    this.calls.push('listArchived');
    return Promise.resolve(success([]));
  }

  public getById(id: VehicleId): Promise<VehicleResult<Vehicle>> {
    this.calls.push(`getById:${id}`);
    return Promise.resolve(success(vehicle));
  }

  public create(input: CreateVehicle): Promise<VehicleResult<Vehicle>> {
    this.calls.push(`create:${input.make}`);
    return Promise.resolve(success(vehicle));
  }

  public update(
    id: VehicleId,
    input: UpdateVehicle,
  ): Promise<VehicleResult<Vehicle>> {
    this.calls.push(`update:${id}:${input.model}`);
    return Promise.resolve(success(vehicle));
  }

  public archive(id: VehicleId): Promise<VehicleResult<Vehicle>> {
    this.calls.push(`archive:${id}`);
    return Promise.resolve(success({
      ...vehicle,
      archivedAt: '2026-07-20T01:00:00.000Z',
    }));
  }

  public restore(id: VehicleId): Promise<VehicleResult<Vehicle>> {
    this.calls.push(`restore:${id}`);
    return Promise.resolve(success(vehicle));
  }

  public delete(id: VehicleId): Promise<VehicleResult<void>> {
    this.calls.push(`delete:${id}`);
    return Promise.resolve(success(undefined));
  }

  public findDuplicate(
    candidate: VehicleDuplicateCandidate,
    excludeVehicleId?: VehicleId,
  ): Promise<VehicleResult<VehicleDuplicateWarning | undefined>> {
    this.calls.push(
      `findDuplicate:${candidate.make}:${excludeVehicleId ?? 'none'}`,
    );
    return Promise.resolve(success({
      vehicleId: vehicle.id,
      label: '2021 Ferrari Roma · TEST 123 WA',
    }));
  }
}

describe('VehicleRepository contract shape', () => {
  it('excludes authorization, system, provider, and generic filter fields', () => {
    expect([
      createUsesOnlyPermittedFields,
      updateUsesOnlyPermittedFields,
      duplicateUsesOnlyPermittedFields,
    ]).toEqual([true, true, true]);
  });

  it('exposes the eight Vehicle workflows with app-owned models and results', async () => {
    const repository = new RecordingVehicleRepository();
    const input: CreateVehicle = {
      make: 'Ferrari',
      model: 'Roma',
      odometerUnit: 'km',
    };

    await expect(repository.listActive()).resolves.toEqual(success([summary]));
    await expect(repository.listArchived()).resolves.toEqual(success([]));
    await expect(repository.getById(vehicle.id)).resolves.toEqual(success(vehicle));
    await expect(repository.create(input)).resolves.toEqual(success(vehicle));
    await expect(repository.update(vehicle.id, input)).resolves.toEqual(success(vehicle));
    await expect(repository.archive(vehicle.id)).resolves.toEqual(success({
      ...vehicle,
      archivedAt: '2026-07-20T01:00:00.000Z',
    }));
    await expect(repository.restore(vehicle.id)).resolves.toEqual(success(vehicle));
    await expect(repository.delete(vehicle.id)).resolves.toEqual(success(undefined));

    expect(repository.calls).toEqual([
      'listActive',
      'listArchived',
      'getById:vehicle-1',
      'create:Ferrari',
      'update:vehicle-1:Roma',
      'archive:vehicle-1',
      'restore:vehicle-1',
      'delete:vehicle-1',
    ]);
  });

  it('adds only an all-lifecycle duplicate lookup with optional edit exclusion', async () => {
    const repository = new RecordingVehicleRepository();
    const candidate: VehicleDuplicateCandidate = {
      make: 'ferrari',
      model: 'roma',
      registration: 'test123',
      registrationState: 'WA',
    };

    await expect(repository.findDuplicate(candidate)).resolves.toEqual(success({
      vehicleId: 'vehicle-1',
      label: '2021 Ferrari Roma · TEST 123 WA',
    }));
    await expect(
      repository.findDuplicate(candidate, 'vehicle-current'),
    ).resolves.toEqual(success({
      vehicleId: 'vehicle-1',
      label: '2021 Ferrari Roma · TEST 123 WA',
    }));

    expect(repository.calls).toEqual([
      'findDuplicate:ferrari:none',
      'findDuplicate:ferrari:vehicle-current',
    ]);
  });

  it('represents no duplicate as success without a uniqueness error', async () => {
    const repository: VehicleRepository = {
      listActive: () => Promise.resolve(success([])),
      listArchived: () => Promise.resolve(success([])),
      getById: () => Promise.resolve(success(vehicle)),
      create: () => Promise.resolve(success(vehicle)),
      update: () => Promise.resolve(success(vehicle)),
      archive: () => Promise.resolve(success(vehicle)),
      restore: () => Promise.resolve(success(vehicle)),
      delete: () => Promise.resolve(success(undefined)),
      findDuplicate: () => Promise.resolve(success(undefined)),
    };

    await expect(repository.findDuplicate({
      make: 'Ferrari',
      model: 'Roma',
    })).resolves.toEqual({ ok: true, value: undefined });
  });
});
