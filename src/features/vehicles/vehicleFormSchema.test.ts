import { describe, expect, it } from 'vitest';
import {
  VEHICLE_ODOMETER_MAX,
  type Vehicle,
} from '../../domain/vehicles/vehicle';
import {
  createVehicleFormDefaults,
  vehicleFormSchema,
  type VehicleFormValues,
} from './vehicleFormSchema';

const nonBmpCharacter = '\u{1F600}';

function validValues(
  overrides: Partial<VehicleFormValues> = {},
): VehicleFormValues {
  return {
    make: 'Ferrari',
    model: 'Roma',
    year: '',
    registration: '',
    vin: '',
    currentOdometer: '',
    odometerUnit: 'km',
    engine: '',
    notes: '',
    ...overrides,
  };
}

describe('vehicleFormSchema', () => {
  it('normalizes required text and clears blank optional values', () => {
    expect(vehicleFormSchema.parse(validValues({
      make: '  Ferrari  ',
      model: '  Roma  ',
      registration: '   ',
      vin: '   ',
      engine: '   ',
      notes: '   ',
    }))).toEqual({
      make: 'Ferrari',
      model: 'Roma',
      odometerUnit: 'km',
    });
  });

  it.each(['make', 'model'] as const)('requires trimmed %s', (field) => {
    const result = vehicleFormSchema.safeParse(validValues({ [field]: '   ' }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toContainEqual(expect.objectContaining({
        path: [field],
      }));
    }
  });

  it.each([
    'make',
    'model',
    'registration',
    'vin',
    'engine',
  ] as const)('accepts 50 and rejects 51 characters for %s', (field) => {
    expect(vehicleFormSchema.safeParse(validValues({ [field]: 'x'.repeat(50) })).success)
      .toBe(true);
    expect(vehicleFormSchema.safeParse(validValues({ [field]: 'x'.repeat(51) })).success)
      .toBe(false);
  });

  it.each([
    'make',
    'model',
    'registration',
    'vin',
    'engine',
  ] as const)('uses code-point limits for non-BMP %s values', (field) => {
    expect(vehicleFormSchema.safeParse(validValues({
      [field]: nonBmpCharacter.repeat(50),
    })).success).toBe(true);
    expect(vehicleFormSchema.safeParse(validValues({
      [field]: nonBmpCharacter.repeat(51),
    })).success).toBe(false);
  });

  it('accepts 500 and rejects 501 characters for notes', () => {
    expect(vehicleFormSchema.safeParse(validValues({ notes: 'x'.repeat(500) })).success)
      .toBe(true);
    expect(vehicleFormSchema.safeParse(validValues({ notes: 'x'.repeat(501) })).success)
      .toBe(false);
  });

  it('uses code-point limits for non-BMP notes', () => {
    expect(vehicleFormSchema.safeParse(validValues({
      notes: nonBmpCharacter.repeat(500),
    })).success).toBe(true);
    expect(vehicleFormSchema.safeParse(validValues({
      notes: nonBmpCharacter.repeat(501),
    })).success).toBe(false);
  });

  it.each(['1900', '9999'] as const)('accepts boundary year %s', (year) => {
    expect(vehicleFormSchema.parse(validValues({ year }))).toMatchObject({
      year: Number(year),
    });
  });

  it.each(['1899', '10000', '2021.5', '-2021', 'year'] as const)(
    'rejects invalid year %s',
    (year) => {
      expect(vehicleFormSchema.safeParse(validValues({ year })).success).toBe(false);
    },
  );

  it.each(['0', String(VEHICLE_ODOMETER_MAX)])(
    'accepts odometer boundary %s and preserves the selected unit',
    (currentOdometer) => {
      expect(vehicleFormSchema.parse(validValues({
        currentOdometer,
        odometerUnit: 'mi',
      }))).toMatchObject({
        currentOdometer: Number(currentOdometer),
        odometerUnit: 'mi',
      });
    },
  );

  it.each([
    '-1',
    '1.5',
    String(VEHICLE_ODOMETER_MAX + 1),
    '9007199254740993',
    '0009007199254740992',
    'reading',
  ] as const)(
    'rejects invalid odometer %s',
    (currentOdometer) => {
      expect(vehicleFormSchema.safeParse(validValues({ currentOdometer })).success)
        .toBe(false);
    },
  );

  it('maps every editable field without protected Vehicle state', () => {
    const vehicle: Vehicle = {
      id: 'vehicle-1',
      ownerId: 'owner-1',
      make: 'Ferrari',
      model: 'Roma',
      year: 2021,
      registration: 'SYN 123',
      vin: 'SYNTHETIC-VIN',
      currentOdometer: 12000,
      odometerUnit: 'mi',
      engine: 'V8',
      notes: 'Private notes',
      archivedAt: '2026-07-20T00:00:00.000Z',
      createdAt: '2026-07-20T00:00:00.000Z',
      updatedAt: '2026-07-20T00:00:00.000Z',
    };

    expect(createVehicleFormDefaults(vehicle)).toEqual({
      make: 'Ferrari',
      model: 'Roma',
      year: '2021',
      registration: 'SYN 123',
      vin: 'SYNTHETIC-VIN',
      currentOdometer: '12000',
      odometerUnit: 'mi',
      engine: 'V8',
      notes: 'Private notes',
    });
    expect(createVehicleFormDefaults()).toMatchObject({ odometerUnit: 'km' });
    expect(createVehicleFormDefaults()).not.toHaveProperty('ownerId');
    expect(createVehicleFormDefaults()).not.toHaveProperty('archivedAt');
    expect(createVehicleFormDefaults()).not.toHaveProperty('createdAt');
  });
});
