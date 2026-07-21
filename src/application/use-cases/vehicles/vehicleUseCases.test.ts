import { describe, expect, it, vi, type Mock } from 'vitest';
import type { AppUser } from '../../../domain/users/appUser';
import type {
  CreateVehicle,
  UpdateVehicle,
  Vehicle,
  VehicleSummary,
} from '../../../domain/vehicles/vehicle';
import type {
  VehicleDuplicateWarning,
  VehicleRepository,
} from '../../ports/vehicleRepository';
import {
  createVehicleError,
  type VehicleErrorCategory,
  type VehicleResult,
} from '../../vehicles/vehicleResult';
import {
  VehicleUseCases,
  type CurrentAppUserSource,
} from './vehicleUseCases';

type Expect<T extends true> = T;
type IsNever<T> = [T] extends [never] ? true : false;

type ForbiddenInputField
  = | 'ownerId'
    | 'role'
    | 'archivedAt'
    | 'createdAt'
    | 'updatedAt';

type CreateInput = Parameters<VehicleUseCases['createVehicle']>[0];
type UpdateInput = Parameters<VehicleUseCases['updateVehicle']>[1];

type MockVehicleRepository = {
  [Method in keyof VehicleRepository]: Mock<VehicleRepository[Method]>;
};

const createExcludesProtectedFields: Expect<
  IsNever<Extract<keyof CreateInput, ForbiddenInputField>>
> = true;
const updateExcludesProtectedFields: Expect<
  IsNever<Extract<keyof UpdateInput, ForbiddenInputField>>
> = true;

const admin: AppUser = {
  id: 'app-user-1',
  displayName: 'Garage Admin',
  role: 'admin',
  createdAt: '2026-07-20T00:00:00.000Z',
  updatedAt: '2026-07-20T00:00:00.000Z',
};

const member: AppUser = {
  ...admin,
  id: 'app-user-2',
  role: 'member',
};

const vehicle: Vehicle = {
  id: 'vehicle-1',
  ownerId: admin.id,
  make: 'Ferrari',
  model: 'Roma',
  year: 2021,
  registration: 'TEST 123',
  vin: 'PRIVATE-VIN',
  currentOdometer: 12_500,
  odometerUnit: 'km',
  engine: '3.9L V8',
  notes: 'Private notes',
  createdAt: '2026-07-20T00:00:00.000Z',
  updatedAt: '2026-07-20T00:00:00.000Z',
};

const archivedVehicle: Vehicle = {
  ...vehicle,
  archivedAt: '2026-07-20T01:00:00.000Z',
};

const summary: VehicleSummary = vehicle;

const validInput: CreateVehicle = {
  make: 'Ferrari',
  model: 'Roma',
  year: 2021,
  registration: 'TEST 123',
  odometerUnit: 'km',
};

function success<T>(value: T): VehicleResult<T> {
  return { ok: true, value };
}

function failure<T>(
  category: Exclude<VehicleErrorCategory, 'validation'>,
): VehicleResult<T> {
  return { ok: false, error: createVehicleError(category) };
}

function createDeferred<T>(): {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

function createRepository(): MockVehicleRepository {
  return {
    listActive: vi.fn().mockResolvedValue(success([summary])),
    listArchived: vi.fn().mockResolvedValue(success([archivedVehicle])),
    getById: vi.fn().mockResolvedValue(success(vehicle)),
    create: vi.fn().mockResolvedValue(success(vehicle)),
    update: vi.fn().mockResolvedValue(success(vehicle)),
    archive: vi.fn().mockResolvedValue(success(archivedVehicle)),
    restore: vi.fn().mockResolvedValue(success(vehicle)),
    delete: vi.fn().mockResolvedValue(success(undefined)),
    findDuplicate: vi.fn().mockResolvedValue(success(undefined)),
  };
}

function createCurrentUserSource(user: AppUser | null): CurrentAppUserSource {
  return { getCurrentAppUser: () => user };
}

function createSubject(
  repository = createRepository(),
  currentUser: AppUser | null = admin,
): VehicleUseCases {
  return new VehicleUseCases(repository, createCurrentUserSource(currentUser));
}

function invokeEveryWorkflow(subject: VehicleUseCases): readonly Promise<unknown>[] {
  return [
    subject.listActiveVehicles(),
    subject.listArchivedVehicles(),
    subject.getVehicle(vehicle.id),
    subject.createVehicle(validInput),
    subject.updateVehicle(vehicle.id, validInput),
    subject.archiveVehicle(vehicle.id),
    subject.restoreVehicle(vehicle.id),
    subject.deleteVehicle(vehicle.id),
  ];
}

describe('VehicleUseCases authorization', () => {
  it.each([
    ['a missing user', null],
    ['a non-admin user', member],
  ])('denies every workflow for %s without calling the repository', async (_, user) => {
    const repository = createRepository();
    const subject = createSubject(repository, user);

    const results = await Promise.all(invokeEveryWorkflow(subject));

    expect(results).toEqual(Array.from({ length: 8 }, () => ({
      ok: false,
      error: createVehicleError('unauthorized'),
    })));
    for (const method of Object.values(repository)) {
      expect(method).not.toHaveBeenCalled();
    }
  });

  it('fails closed when the current-user source throws', async () => {
    const repository = createRepository();
    const source: CurrentAppUserSource = {
      getCurrentAppUser: () => {
        throw new Error('authentication state detail');
      },
    };
    const subject = new VehicleUseCases(repository, source);

    await expect(subject.listActiveVehicles()).resolves.toEqual(
      failure('unauthorized'),
    );
    expect(repository.listActive).not.toHaveBeenCalled();
  });

  it('exposes create and update commands without protected fields', () => {
    expect([createExcludesProtectedFields, updateExcludesProtectedFields]).toEqual([
      true,
      true,
    ]);
  });
});

describe('VehicleUseCases reads and lifecycle commands', () => {
  it('delegates all approved workflows for the current Garage Admin', async () => {
    const repository = createRepository();
    const subject = createSubject(repository);

    await expect(subject.listActiveVehicles()).resolves.toEqual(success([summary]));
    await expect(subject.listArchivedVehicles()).resolves.toEqual(
      success([archivedVehicle]),
    );
    await expect(subject.getVehicle(vehicle.id)).resolves.toEqual(success(vehicle));
    await expect(subject.createVehicle(validInput)).resolves.toEqual(success({
      vehicle,
    }));
    await expect(subject.updateVehicle(vehicle.id, validInput)).resolves.toEqual(
      success({ vehicle }),
    );
    await expect(subject.archiveVehicle(vehicle.id)).resolves.toEqual(
      success(archivedVehicle),
    );
    await expect(subject.restoreVehicle(vehicle.id)).resolves.toEqual(success(vehicle));
    await expect(subject.deleteVehicle(vehicle.id)).resolves.toEqual(success(undefined));

    expect(repository.listActive).toHaveBeenCalledOnce();
    expect(repository.listArchived).toHaveBeenCalledOnce();
    expect(repository.getById).toHaveBeenCalledWith(vehicle.id);
    expect(repository.archive).toHaveBeenCalledWith(vehicle.id);
    expect(repository.restore).toHaveBeenCalledWith(vehicle.id);
    expect(repository.delete).toHaveBeenCalledWith(vehicle.id);
  });

  it.each([
    [
      'active list',
      (repository: MockVehicleRepository) => repository.listActive
        .mockResolvedValue(failure('temporary_failure')),
      (subject: VehicleUseCases) => subject.listActiveVehicles(),
    ],
    [
      'archived list',
      (repository: MockVehicleRepository) => repository.listArchived
        .mockResolvedValue(failure('temporary_failure')),
      (subject: VehicleUseCases) => subject.listArchivedVehicles(),
    ],
    [
      'get',
      (repository: MockVehicleRepository) => repository.getById
        .mockResolvedValue(failure('temporary_failure')),
      (subject: VehicleUseCases) => subject.getVehicle(vehicle.id),
    ],
    [
      'archive',
      (repository: MockVehicleRepository) => repository.archive
        .mockResolvedValue(failure('temporary_failure')),
      (subject: VehicleUseCases) => subject.archiveVehicle(vehicle.id),
    ],
    [
      'restore',
      (repository: MockVehicleRepository) => repository.restore
        .mockResolvedValue(failure('temporary_failure')),
      (subject: VehicleUseCases) => subject.restoreVehicle(vehicle.id),
    ],
    [
      'delete',
      (repository: MockVehicleRepository) => repository.delete
        .mockResolvedValue(failure('temporary_failure')),
      (subject: VehicleUseCases) => subject.deleteVehicle(vehicle.id),
    ],
  ] as const)(
    'returns safe repository failures from %s',
    async (_, failRepository, invoke) => {
      const repository = createRepository();
      failRepository(repository);

      await expect(invoke(createSubject(repository))).resolves.toEqual(
        failure('temporary_failure'),
      );
    },
  );

  it('preserves lifecycle conflicts from archive and restore', async () => {
    const repository = createRepository();
    vi.mocked(repository.archive).mockResolvedValue(failure('lifecycle_conflict'));
    vi.mocked(repository.restore).mockResolvedValue(failure('lifecycle_conflict'));
    const subject = createSubject(repository);

    await expect(subject.archiveVehicle(vehicle.id)).resolves.toEqual(
      failure('lifecycle_conflict'),
    );
    await expect(subject.restoreVehicle(vehicle.id)).resolves.toEqual(
      failure('lifecycle_conflict'),
    );
  });

  it('maps an unexpected repository rejection to a safe temporary failure', async () => {
    const repository = createRepository();
    vi.mocked(repository.getById).mockRejectedValue(new Error('private provider detail'));

    await expect(createSubject(repository).getVehicle(vehicle.id)).resolves.toEqual(
      failure('temporary_failure'),
    );
  });
});

describe('VehicleUseCases create and update', () => {
  it.each([
    ['create', null],
    ['create', { ...admin, role: 'member' }],
    ['create', { ...admin, id: 'replacement-admin' }],
    ['update', null],
    ['update', { ...admin, role: 'member' }],
    ['update', { ...admin, id: 'replacement-admin' }],
  ] as const)(
    'does not persist %s after the initiating admin changes to %j during duplicate lookup',
    async (operation, replacementUser) => {
      const repository = createRepository();
      const duplicateResult = createDeferred<
        Awaited<ReturnType<VehicleRepository['findDuplicate']>>
      >();
      vi.mocked(repository.findDuplicate).mockReturnValue(duplicateResult.promise);
      let currentUser: AppUser | null = admin;
      const subject = new VehicleUseCases(repository, {
        getCurrentAppUser: () => currentUser,
      });

      const result = operation === 'create'
        ? subject.createVehicle(validInput)
        : subject.updateVehicle(vehicle.id, validInput);

      expect(repository.findDuplicate).toHaveBeenCalledOnce();
      currentUser = replacementUser;
      duplicateResult.resolve(success(undefined));

      await expect(result).resolves.toEqual(failure('unauthorized'));
      expect(repository.create).not.toHaveBeenCalled();
      expect(repository.update).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['create', success<VehicleDuplicateWarning | undefined>(undefined)],
    ['create', failure<VehicleDuplicateWarning | undefined>('temporary_failure')],
    ['update', success<VehicleDuplicateWarning | undefined>(undefined)],
    ['update', failure<VehicleDuplicateWarning | undefined>('temporary_failure')],
  ] as const)(
    'persists %s after a deferred duplicate result when the initiating admin is unchanged',
    async (operation, resolvedDuplicateResult) => {
      const repository = createRepository();
      const duplicateResult = createDeferred<
        Awaited<ReturnType<VehicleRepository['findDuplicate']>>
      >();
      vi.mocked(repository.findDuplicate).mockReturnValue(duplicateResult.promise);
      const subject = createSubject(repository);

      const result = operation === 'create'
        ? subject.createVehicle(validInput)
        : subject.updateVehicle(vehicle.id, validInput);

      expect(repository.findDuplicate).toHaveBeenCalledOnce();
      duplicateResult.resolve(resolvedDuplicateResult);

      await expect(result).resolves.toEqual(success({ vehicle }));
      expect(repository[operation]).toHaveBeenCalledOnce();
    },
  );

  it.each([
    ['create', (subject: VehicleUseCases, input: CreateVehicle) => subject.createVehicle(input)],
    [
      'update',
      (subject: VehicleUseCases, input: UpdateVehicle) => subject.updateVehicle(vehicle.id, input),
    ],
  ] as const)('rejects invalid %s input before duplicate lookup or persistence', async (_, invoke) => {
    const repository = createRepository();
    const subject = createSubject(repository);

    await expect(invoke(subject, {
      make: '   ',
      model: 'Roma',
      odometerUnit: 'km',
    })).resolves.toEqual({
      ok: false,
      error: {
        category: 'validation',
        message: 'Some Vehicle details are invalid. Review the highlighted fields.',
        issues: [{ field: 'make', code: 'required' }],
      },
    });
    expect(repository.findDuplicate).not.toHaveBeenCalled();
    expect(repository.create).not.toHaveBeenCalled();
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('normalizes and whitelists create input before repository calls', async () => {
    const repository = createRepository();
    const subject = createSubject(repository);
    const untrustedInput = {
      make: '  Ferrari  ',
      model: '  Roma  ',
      registration: '  TEST 123  ',
      vin: '   ',
      currentOdometer: 0,
      odometerUnit: 'km',
      engine: '  3.9L V8  ',
      notes: '   ',
      ownerId: 'caller-owner',
      role: 'admin',
      archivedAt: '2020-01-01T00:00:00.000Z',
      createdAt: '2020-01-01T00:00:00.000Z',
      updatedAt: '2020-01-01T00:00:00.000Z',
    } as CreateVehicle;

    await subject.createVehicle(untrustedInput);

    const expected: CreateVehicle = {
      make: 'Ferrari',
      model: 'Roma',
      registration: 'TEST 123',
      currentOdometer: 0,
      odometerUnit: 'km',
      engine: '3.9L V8',
    };
    expect(repository.findDuplicate).toHaveBeenCalledWith({
      make: 'Ferrari',
      model: 'Roma',
      registration: 'TEST 123',
    });
    expect(repository.create).toHaveBeenCalledWith(expected);
  });

  it('returns a non-blocking duplicate warning after create persists', async () => {
    const repository = createRepository();
    const duplicateWarning = {
      vehicleId: 'vehicle-duplicate',
      label: '2021 Ferrari Roma · TEST 123',
    };
    vi.mocked(repository.findDuplicate).mockResolvedValue(success(duplicateWarning));

    await expect(createSubject(repository).createVehicle(validInput)).resolves.toEqual(
      success({ vehicle, duplicateWarning }),
    );
    expect(repository.create).toHaveBeenCalledOnce();
  });

  it('excludes the current Vehicle from update duplicate lookup', async () => {
    const repository = createRepository();
    const duplicateWarning = {
      vehicleId: 'vehicle-duplicate',
      label: '2021 Ferrari Roma · TEST 123',
    };
    vi.mocked(repository.findDuplicate).mockResolvedValue(success(duplicateWarning));

    await expect(
      createSubject(repository).updateVehicle(vehicle.id, validInput),
    ).resolves.toEqual(success({ vehicle, duplicateWarning }));
    expect(repository.findDuplicate).toHaveBeenCalledWith({
      make: 'Ferrari',
      model: 'Roma',
      registration: 'TEST 123',
    }, vehicle.id);
    expect(repository.update).toHaveBeenCalledWith(vehicle.id, validInput);
  });

  it.each(['create', 'update'] as const)(
    'keeps %s persistence available when duplicate lookup is unavailable',
    async (operation) => {
      const repository = createRepository();
      vi.mocked(repository.findDuplicate).mockResolvedValue(
        failure('temporary_failure'),
      );
      const subject = createSubject(repository);

      const result = operation === 'create'
        ? await subject.createVehicle(validInput)
        : await subject.updateVehicle(vehicle.id, validInput);

      expect(result).toEqual(success({ vehicle }));
      expect(repository[operation]).toHaveBeenCalledOnce();
    },
  );

  it.each(['create', 'update'] as const)(
    'returns safe %s persistence failures without a false success',
    async (operation) => {
      const repository = createRepository();
      vi.mocked(repository[operation]).mockResolvedValue(failure('not_found') as never);
      const subject = createSubject(repository);

      const result = operation === 'create'
        ? await subject.createVehicle(validInput)
        : await subject.updateVehicle(vehicle.id, validInput);

      expect(result).toEqual(failure('not_found'));
    },
  );

  it('allows odometer-unit changes while Service Record history is deferred', async () => {
    const repository = createRepository();
    const milesInput: UpdateVehicle = {
      ...validInput,
      odometerUnit: 'mi',
    };

    await expect(
      createSubject(repository).updateVehicle(vehicle.id, milesInput),
    ).resolves.toEqual(success({ vehicle }));
    expect(repository.update).toHaveBeenCalledWith(vehicle.id, milesInput);
  });

  it('allows current permanent deletion without a history precheck', async () => {
    const repository = createRepository();

    await expect(createSubject(repository).deleteVehicle(vehicle.id)).resolves.toEqual(
      success(undefined),
    );
    expect(repository.getById).not.toHaveBeenCalled();
    expect(repository.delete).toHaveBeenCalledWith(vehicle.id);
  });
});
