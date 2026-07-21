import { describe, expect, it } from 'vitest';
import { VEHICLE_ODOMETER_MAX } from '../../../domain/vehicles/vehicle';
import { mapVehicleRow, mapVehicleSummaryRow } from './mapVehicleRow';

const fullRow = {
  id: '10000000-0000-4000-8000-000000000001',
  owner_id: '20000000-0000-4000-8000-000000000001',
  make: 'Ferrari',
  model: 'Roma',
  year: 2021,
  registration: 'TEST 123',
  vin: 'SYNTHETIC-VIN',
  current_odometer: 12_500,
  odometer_unit: 'km',
  engine: 'Synthetic V8',
  notes: 'Synthetic notes',
  archived_at: null,
  created_at: '2026-07-20T01:00:00.000Z',
  updated_at: '2026-07-20T02:00:00.000Z',
};
const nonBmpCharacter = '\u{1F600}';

describe('Vehicle Supabase row mapping', () => {
  it('maps a complete unknown row to an app-owned camel-cased Vehicle', () => {
    expect(mapVehicleRow(fullRow)).toEqual({
      id: fullRow.id,
      ownerId: fullRow.owner_id,
      make: 'Ferrari',
      model: 'Roma',
      year: 2021,
      registration: 'TEST 123',
      vin: 'SYNTHETIC-VIN',
      currentOdometer: 12_500,
      odometerUnit: 'km',
      engine: 'Synthetic V8',
      notes: 'Synthetic notes',
      createdAt: fullRow.created_at,
      updatedAt: fullRow.updated_at,
    });
  });

  it('maps the maximum safely representable odometer in full and summary rows', () => {
    const row = { ...fullRow, current_odometer: VEHICLE_ODOMETER_MAX };

    expect(mapVehicleRow(row)).toMatchObject({
      currentOdometer: VEHICLE_ODOMETER_MAX,
    });
    expect(mapVehicleSummaryRow(row)).toMatchObject({
      currentOdometer: VEHICLE_ODOMETER_MAX,
    });
  });

  it('maps database-valid non-BMP text at every exact character boundary', () => {
    const row = {
      ...fullRow,
      make: nonBmpCharacter.repeat(50),
      model: nonBmpCharacter.repeat(50),
      registration: nonBmpCharacter.repeat(50),
      vin: nonBmpCharacter.repeat(50),
      engine: nonBmpCharacter.repeat(50),
      notes: nonBmpCharacter.repeat(500),
    };

    expect(mapVehicleRow(row)).toMatchObject({
      make: row.make,
      model: row.model,
      registration: row.registration,
      vin: row.vin,
      engine: row.engine,
      notes: row.notes,
    });
    expect(mapVehicleSummaryRow(row)).toMatchObject({
      make: row.make,
      model: row.model,
      registration: row.registration,
    });
  });

  it.each([
    ['make', 51],
    ['model', 51],
    ['registration', 51],
    ['vin', 51],
    ['engine', 51],
    ['notes', 501],
  ] as const)('rejects non-BMP %s rows one code point over the limit', (field, count) => {
    expect(mapVehicleRow({
      ...fullRow,
      [field]: nonBmpCharacter.repeat(count),
    })).toBeNull();
  });

  it('omits nullable optional values and normalizes text', () => {
    expect(mapVehicleRow({
      ...fullRow,
      make: ' Ferrari ',
      model: ' Roma ',
      year: null,
      registration: ' ',
      vin: null,
      current_odometer: null,
      engine: null,
      notes: null,
      archived_at: '2026-07-20T03:00:00.000Z',
    })).toEqual({
      id: fullRow.id,
      ownerId: fullRow.owner_id,
      make: 'Ferrari',
      model: 'Roma',
      odometerUnit: 'km',
      archivedAt: '2026-07-20T03:00:00.000Z',
      createdAt: fullRow.created_at,
      updatedAt: fullRow.updated_at,
    });
  });

  it.each([
    null,
    [],
    { ...fullRow, id: 'not-an-id' },
    { ...fullRow, owner_id: null },
    { ...fullRow, year: 18_99 },
    { ...fullRow, current_odometer: -1 },
    { ...fullRow, current_odometer: VEHICLE_ODOMETER_MAX + 1 },
    { ...fullRow, odometer_unit: 'miles' },
    { ...fullRow, notes: 'x'.repeat(501) },
    { ...fullRow, created_at: 'not-a-timestamp' },
  ])('rejects a malformed full row %#', (row) => {
    expect(mapVehicleRow(row)).toBeNull();
  });

  it('maps only the summary fields selected by list queries', () => {
    const summaryRow = {
      id: fullRow.id,
      make: fullRow.make,
      model: fullRow.model,
      year: fullRow.year,
      registration: fullRow.registration,
      current_odometer: fullRow.current_odometer,
      odometer_unit: fullRow.odometer_unit,
      archived_at: fullRow.archived_at,
    };

    expect(mapVehicleSummaryRow(summaryRow)).toEqual({
      id: fullRow.id,
      make: 'Ferrari',
      model: 'Roma',
      year: 2021,
      registration: 'TEST 123',
      currentOdometer: 12_500,
      odometerUnit: 'km',
    });
  });
});
