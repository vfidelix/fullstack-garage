import { describe, expect, it } from 'vitest';
import type { AppUserId } from '../users/appUser';
import {
  VEHICLE_ODOMETER_MAX,
  AUSTRALIAN_REGISTRATION_STATES,
  countVehicleTextCharacters,
  findDuplicateVehicle,
  formatVehicleLabel,
  getVehicleLifecycleState,
  normalizeVehicleInput,
  validateCreateVehicle,
  validateUpdateVehicle,
  type CreateVehicle,
  type UpdateVehicle,
  type Vehicle,
  type VehicleId,
  type VehicleSummary,
} from './vehicle';

const ownerId: AppUserId = 'app-user-1';
const nonBmpCharacter = '\u{1F600}';

function buildVehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: 'vehicle-1',
    ownerId,
    make: 'Ferrari',
    model: 'Roma',
    year: '2021',
    registration: 'ABC 123',
    registrationState: 'WA',
    vin: 'TESTVIN00000000001',
    currentOdometer: 12_500,
    odometerUnit: 'km',
    engine: '3.9L V8',
    body: 'Coupe',
    notes: 'Synthetic test vehicle',
    createdAt: '2026-07-20T00:00:00.000Z',
    updatedAt: '2026-07-20T00:00:00.000Z',
    ...overrides,
  };
}

function expectValidCreate(input: CreateVehicle): CreateVehicle {
  const result = validateCreateVehicle(input);

  expect(result.valid).toBe(true);
  if (!result.valid) {
    throw new Error('Expected valid Vehicle input');
  }

  return result.value;
}

describe('Vehicle domain contracts', () => {
  it('keeps protected and lifecycle fields out of create and update inputs', () => {
    type ProtectedField
      = | 'id'
        | 'ownerId'
        | 'archivedAt'
        | 'createdAt'
        | 'updatedAt';
    type CreateProtectedFields = Extract<keyof CreateVehicle, ProtectedField>;
    type UpdateProtectedFields = Extract<keyof UpdateVehicle, ProtectedField>;

    const createHasProtectedFields: CreateProtectedFields extends never
      ? false
      : true = false;
    const updateHasProtectedFields: UpdateProtectedFields extends never
      ? false
      : true = false;

    expect(createHasProtectedFields).toBe(false);
    expect(updateHasProtectedFields).toBe(false);
  });

  it('supports app-owned IDs, immutable entities, and summaries', () => {
    const vehicleId: VehicleId = 'vehicle-1';
    const vehicle = buildVehicle({ id: vehicleId });
    const summary: VehicleSummary = {
      id: vehicle.id,
      make: vehicle.make,
      model: vehicle.model,
      ...(vehicle.year === undefined ? {} : { year: vehicle.year }),
      ...(vehicle.registration === undefined
        ? {}
        : { registration: vehicle.registration }),
      ...(vehicle.registrationState === undefined
        ? {}
        : { registrationState: vehicle.registrationState }),
      ...(vehicle.currentOdometer === undefined
        ? {}
        : { currentOdometer: vehicle.currentOdometer }),
      odometerUnit: vehicle.odometerUnit,
      ...(vehicle.archivedAt === undefined
        ? {}
        : { archivedAt: vehicle.archivedAt }),
    };

    expect(summary.id).toBe(vehicleId);
  });
});

describe('Vehicle input normalization and validation', () => {
  it('counts Unicode code points like PostgreSQL char_length', () => {
    expect(nonBmpCharacter).toHaveLength(2);
    expect(countVehicleTextCharacters(nonBmpCharacter)).toBe(1);
  });

  it('trims required and optional text and removes blank optional text', () => {
    const input: CreateVehicle = {
      make: '  Ferrari  ',
      model: '  Roma  ',
      year: '  2018-2021  ',
      registration: '  ABC 123  ',
      registrationState: ' wa ',
      vin: '   ',
      currentOdometer: 0,
      odometerUnit: 'km',
      engine: '  3.9L V8  ',
      body: '  Coupe  ',
      notes: '  Synthetic note  ',
    };

    expect(normalizeVehicleInput(input)).toEqual({
      make: 'Ferrari',
      model: 'Roma',
      year: '2018-2021',
      registration: 'ABC 123',
      registrationState: 'WA',
      currentOdometer: 0,
      odometerUnit: 'km',
      engine: '3.9L V8',
      body: 'Coupe',
      notes: 'Synthetic note',
    });
  });

  it.each([
    ['make', { make: '   ', model: 'Roma', odometerUnit: 'km' }],
    ['model', { make: 'Ferrari', model: '\t', odometerUnit: 'km' }],
  ] as const)('requires a nonblank %s', (field, input) => {
    const result = validateCreateVehicle(input);

    expect(result).toEqual({
      valid: false,
      issues: [{ field, code: 'required' }],
    });
  });

  it.each([
    ['make', 'M'.repeat(50)],
    ['model', 'M'.repeat(50)],
    ['year', 'Y'.repeat(50)],
    ['registration', 'R'.repeat(50)],
    ['vin', 'V'.repeat(50)],
    ['engine', 'E'.repeat(50)],
    ['body', 'B'.repeat(50)],
  ] as const)('accepts the exact 50-character %s limit', (field, value) => {
    const input = {
      make: 'Ferrari',
      model: 'Roma',
      odometerUnit: 'km' as const,
      [field]: value,
    };

    expect(validateCreateVehicle(input).valid).toBe(true);
  });

  it.each(['make', 'model', 'year', 'registration', 'vin', 'engine', 'body'] as const)(
    'rejects %s beyond 50 characters',
    (field) => {
      const result = validateCreateVehicle({
        make: 'Ferrari',
        model: 'Roma',
        odometerUnit: 'km',
        [field]: 'X'.repeat(51),
      });

      expect(result).toEqual({
        valid: false,
        issues: [{ field, code: 'too_long' }],
      });
    },
  );

  it.each([
    'make',
    'model',
    'year',
    'registration',
    'vin',
    'engine',
    'body',
  ] as const)(
    'accepts 50 non-BMP code points and rejects 51 for %s',
    (field) => {
      const exactBoundary = validateCreateVehicle({
        make: 'Ferrari',
        model: 'Roma',
        odometerUnit: 'km',
        [field]: nonBmpCharacter.repeat(50),
      });
      const overBoundary = validateCreateVehicle({
        make: 'Ferrari',
        model: 'Roma',
        odometerUnit: 'km',
        [field]: nonBmpCharacter.repeat(51),
      });

      expect(exactBoundary.valid).toBe(true);
      expect(overBoundary).toEqual({
        valid: false,
        issues: [{ field, code: 'too_long' }],
      });
    },
  );

  it('accepts exactly 500 note characters and rejects 501', () => {
    expectValidCreate({
      make: 'Ferrari',
      model: 'Roma',
      odometerUnit: 'km',
      notes: 'N'.repeat(500),
    });

    expect(validateCreateVehicle({
      make: 'Ferrari',
      model: 'Roma',
      odometerUnit: 'km',
      notes: 'N'.repeat(501),
    })).toEqual({
      valid: false,
      issues: [{ field: 'notes', code: 'too_long' }],
    });
  });

  it('accepts 500 non-BMP note code points and rejects 501', () => {
    expect(validateCreateVehicle({
      make: 'Ferrari',
      model: 'Roma',
      odometerUnit: 'km',
      notes: nonBmpCharacter.repeat(500),
    }).valid).toBe(true);
    expect(validateCreateVehicle({
      make: 'Ferrari',
      model: 'Roma',
      odometerUnit: 'km',
      notes: nonBmpCharacter.repeat(501),
    })).toEqual({
      valid: false,
      issues: [{ field: 'notes', code: 'too_long' }],
    });
  });

  it.each(['1900', '2026', '9999', '2018-2021', 'provider year'])('accepts bounded persisted year text %s', (year) => {
    expectValidCreate({
      make: 'Ferrari',
      model: 'Roma',
      year,
      odometerUnit: 'km',
    });
  });

  it('trims persisted Year and omits a blank value', () => {
    expect(expectValidCreate({
      make: 'Ferrari',
      model: 'Roma',
      year: '  2018-2021  ',
      odometerUnit: 'km',
    }).year).toBe('2018-2021');

    expect(expectValidCreate({
      make: 'Ferrari',
      model: 'Roma',
      year: '   ',
      odometerUnit: 'km',
    })).not.toHaveProperty('year');
  });

  it.each([0, 1, VEHICLE_ODOMETER_MAX])(
    'accepts the inclusive odometer boundary: %i',
    (currentOdometer) => {
      expectValidCreate({
        make: 'Ferrari',
        model: 'Roma',
        currentOdometer,
        odometerUnit: 'mi',
      });
    },
  );

  it.each([
    -1,
    0.5,
    VEHICLE_ODOMETER_MAX + 1,
    Number.NaN,
    Number.POSITIVE_INFINITY,
  ])(
    'rejects invalid odometer %s',
    (currentOdometer) => {
      expect(validateCreateVehicle({
        make: 'Ferrari',
        model: 'Roma',
        currentOdometer,
        odometerUnit: 'km',
      })).toEqual({
        valid: false,
        issues: [{ field: 'currentOdometer', code: 'invalid_odometer' }],
      });
    },
  );

  it('allows only kilometre and mile odometer units', () => {
    expect(validateCreateVehicle({
      make: 'Ferrari',
      model: 'Roma',
      odometerUnit: 'KM' as 'km',
    })).toEqual({
      valid: false,
      issues: [{ field: 'odometerUnit', code: 'invalid_odometer_unit' }],
    });
  });

  it('normalizes blank and lowercase Australian registration states', () => {
    expect(validateCreateVehicle({
      make: 'Ferrari',
      model: 'Roma',
      registrationState: ' wa ',
      odometerUnit: 'km',
    })).toEqual({
      valid: true,
      value: {
        make: 'Ferrari',
        model: 'Roma',
        registrationState: 'WA',
        odometerUnit: 'km',
      },
    });
    expect(validateCreateVehicle({
      make: 'Ferrari',
      model: 'Roma',
      registrationState: ' ',
      odometerUnit: 'km',
    })).toEqual({
      valid: true,
      value: {
        make: 'Ferrari',
        model: 'Roma',
        odometerUnit: 'km',
      },
    });
  });

  it('accepts only approved Australian registration states', () => {
    for (const registrationState of AUSTRALIAN_REGISTRATION_STATES) {
      expectValidCreate({
        make: 'Ferrari',
        model: 'Roma',
        registrationState,
        odometerUnit: 'km',
      });
    }

    expect(validateCreateVehicle({
      make: 'Ferrari',
      model: 'Roma',
      registrationState: 'NZ',
      odometerUnit: 'km',
    })).toEqual({
      valid: false,
      issues: [{
        field: 'registrationState',
        code: 'invalid_registration_state',
      }],
    });
  });

  it('applies the same normalization and invariants to updates', () => {
    const result = validateUpdateVehicle({
      make: ' Ferrari ',
      model: ' Roma ',
      odometerUnit: 'mi',
    });

    expect(result).toEqual({
      valid: true,
      value: {
        make: 'Ferrari',
        model: 'Roma',
        odometerUnit: 'mi',
      },
    });
  });

  it('applies non-BMP code-point boundaries to updates', () => {
    expect(validateUpdateVehicle({
      make: nonBmpCharacter.repeat(50),
      model: 'Roma',
      odometerUnit: 'km',
      notes: nonBmpCharacter.repeat(500),
    }).valid).toBe(true);
    expect(validateUpdateVehicle({
      make: nonBmpCharacter.repeat(51),
      model: 'Roma',
      odometerUnit: 'km',
    })).toEqual({
      valid: false,
      issues: [{ field: 'make', code: 'too_long' }],
    });
  });

  it('reports all invalid fields in deterministic field order', () => {
    const result = validateCreateVehicle({
      make: ' ',
      model: ' ',
      year: 'Y'.repeat(51),
      registration: 'R'.repeat(51),
      registrationState: 'NZ',
      vin: 'V'.repeat(51),
      currentOdometer: -1,
      odometerUnit: 'miles' as 'mi',
      engine: 'E'.repeat(51),
      body: 'B'.repeat(51),
      notes: 'N'.repeat(501),
    });

    expect(result).toEqual({
      valid: false,
      issues: [
        { field: 'make', code: 'required' },
        { field: 'model', code: 'required' },
        { field: 'year', code: 'too_long' },
        { field: 'registration', code: 'too_long' },
        { field: 'registrationState', code: 'invalid_registration_state' },
        { field: 'vin', code: 'too_long' },
        { field: 'currentOdometer', code: 'invalid_odometer' },
        { field: 'odometerUnit', code: 'invalid_odometer_unit' },
        { field: 'engine', code: 'too_long' },
        { field: 'body', code: 'too_long' },
        { field: 'notes', code: 'too_long' },
      ],
    });
  });
});

describe('formatVehicleLabel', () => {
  it.each([
    [{ make: 'Ferrari', model: 'Roma', year: '2021', registration: 'ABC 123' }, '2021 Ferrari Roma · ABC 123'],
    [{ make: 'Ferrari', model: 'Roma', year: '2021', registration: 'ABC 123', registrationState: 'WA' }, '2021 Ferrari Roma · ABC 123 WA'],
    [{ make: 'Ferrari', model: 'Roma', year: '2021', registrationState: 'WA' }, '2021 Ferrari Roma'],
    [{ make: 'Ferrari', model: 'Roma', year: '2018-2021', body: 'Coupe' }, '2018-2021 Ferrari Roma'],
    [{ make: 'Ferrari', model: 'Roma', registration: 'ABC 123' }, 'Ferrari Roma · ABC 123'],
    [{ make: 'Ferrari', model: 'Roma' }, 'Ferrari Roma'],
  ] as const)('formats the approved compact label', (vehicle, expected) => {
    expect(formatVehicleLabel(vehicle)).toBe(expected);
  });
});

describe('Vehicle lifecycle', () => {
  it('models active and archived Vehicles from archive state', () => {
    expect(getVehicleLifecycleState(buildVehicle())).toBe('active');
    expect(getVehicleLifecycleState(buildVehicle({ archivedAt: '2026-07-20T01:00:00.000Z' }))).toBe('archived');
  });
});

describe('duplicate Vehicle comparison', () => {
  const vehicles: readonly VehicleSummary[] = [
    buildVehicle(),
    {
      id: 'vehicle-2',
      make: 'Alfa Romeo',
      model: 'Giulia Quadrifoglio',
      odometerUnit: 'km',
    },
    buildVehicle({
      id: 'vehicle-3',
      make: 'Ferrari',
      model: 'Roma',
      registration: 'OTHER',
      registrationState: 'WA',
      archivedAt: '2026-07-20T01:00:00.000Z',
    }),
  ];

  it('ignores capitalization and spaces in make, model, and registration', () => {
    expect(findDuplicateVehicle(vehicles, {
      make: 'f E r r a r i',
      model: 'R O M A',
      registration: 'a b c 1 2 3',
      registrationState: 'w a',
    })?.id).toBe('vehicle-1');
  });

  it('treats two missing registrations as equal', () => {
    expect(findDuplicateVehicle(vehicles, {
      make: 'alfaromeo',
      model: 'giuliaquadrifoglio',
    })?.id).toBe('vehicle-2');
  });

  it('treats two missing registration states as equal', () => {
    expect(findDuplicateVehicle(vehicles, {
      make: 'alfaromeo',
      model: 'giuliaquadrifoglio',
    })?.id).toBe('vehicle-2');
  });

  it('does not match the same registration in a different registration state', () => {
    expect(findDuplicateVehicle(vehicles, {
      make: 'Ferrari',
      model: 'Roma',
      registration: 'ABC123',
      registrationState: 'VIC',
    })).toBeUndefined();
  });

  it('does not match a missing registration to a present registration', () => {
    expect(findDuplicateVehicle(vehicles, {
      make: 'Ferrari',
      model: 'Roma',
    })).toBeUndefined();
  });

  it('includes archived Vehicles in comparison', () => {
    expect(findDuplicateVehicle(vehicles, {
      make: 'Ferrari',
      model: 'Roma',
      registration: 'other',
      registrationState: 'WA',
    })?.id).toBe('vehicle-3');
  });

  it('can exclude the current Vehicle during editing', () => {
    expect(findDuplicateVehicle(vehicles, {
      make: 'Ferrari',
      model: 'Roma',
      registration: 'ABC123',
    }, 'vehicle-1')).toBeUndefined();
  });
});
