import { describe, expect, it } from 'vitest';
import type { VehicleErrorCategory } from '../../../application/vehicles/vehicleResult';
import { mapSupabaseVehicleError } from './mapVehicleError';

interface MappingCase {
  readonly category: VehicleErrorCategory;
  readonly error: unknown;
}

const cases: readonly MappingCase[] = [
  { category: 'validation', error: { code: '23514' } },
  { category: 'validation', error: { code: '22001' } },
  { category: 'not_found', error: { code: 'P0002', status: 404 } },
  { category: 'temporary_failure', error: { status: 404 } },
  { category: 'temporary_failure', error: { code: 'PGRST116' } },
  { category: 'temporary_failure', error: { code: 'PGRST202' } },
  { category: 'temporary_failure', error: { code: 'PGRST205' } },
  { category: 'unauthorized', error: { code: '42501' } },
  { category: 'unauthorized', error: { status: 403 } },
  { category: 'lifecycle_conflict', error: { code: '55000' } },
  { category: 'temporary_failure', error: { code: 'PGRST000' } },
  { category: 'temporary_failure', error: new TypeError('network') },
  { category: 'temporary_failure', error: null },
];

describe('mapSupabaseVehicleError', () => {
  it.each(cases)('maps a provider failure to $category', ({ category, error }) => {
    expect(mapSupabaseVehicleError(error).category).toBe(category);
  });

  it('maps completed-history guards only for the guarded Vehicle operations', () => {
    expect(mapSupabaseVehicleError({ code: '55000' }, 'delete').category)
      .toBe('service_record_history_conflict');
    expect(mapSupabaseVehicleError({ code: '55000' }, 'update').category)
      .toBe('service_record_history_conflict');
    expect(mapSupabaseVehicleError({ code: '55000' }, 'archive').category)
      .toBe('lifecycle_conflict');
  });

  it('returns only fixed safe fields and does not retain private provider data', () => {
    const privateMarker = 'private-vehicle-sentinel';
    const mapped = mapSupabaseVehicleError({
      cause: new Error(privateMarker),
      code: 'unknown-provider-code',
      details: `vehicles.registration=${privateMarker}`,
      hint: `archive_vehicle(${privateMarker})`,
      message: privateMarker,
      payload: { vin: privateMarker, notes: privateMarker },
      query: `select * from vehicles where notes = '${privateMarker}'`,
    });

    expect(mapped).toEqual({
      category: 'temporary_failure',
      message: 'Vehicles are temporarily unavailable. Please try again.',
    });
    expect(JSON.stringify(mapped)).not.toContain(privateMarker);
    expect(Object.keys(mapped)).toEqual(['category', 'message']);
  });

  it('uses the fixed validation message without retaining constraint details', () => {
    const mapped = mapSupabaseVehicleError({
      code: '23514',
      message: 'private relation and registration value',
    });

    expect(mapped).toEqual({
      category: 'validation',
      message: 'Some Vehicle details are invalid. Review the highlighted fields.',
      issues: [],
    });
  });

  it.each([
    { code: undefined, status: 404 },
    { code: 'PGRST202', status: 404 },
    { code: 'PGRST205', status: 404 },
  ])('redacts a missing provider resource reported as $code', ({ code, status }) => {
    const privateMarker = 'private-missing-resource-sentinel';
    const mapped = mapSupabaseVehicleError({
      code,
      details: `vehicles.notes=${privateMarker}`,
      hint: `archive_vehicle(${privateMarker})`,
      message: privateMarker,
      payload: { registration: privateMarker },
      query: `select * from vehicles where vin = '${privateMarker}'`,
      status,
    });

    expect(mapped).toEqual({
      category: 'temporary_failure',
      message: 'Vehicles are temporarily unavailable. Please try again.',
    });
    expect(JSON.stringify(mapped)).not.toContain(privateMarker);
  });
});
