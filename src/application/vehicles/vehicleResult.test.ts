import { describe, expect, it } from 'vitest';
import type { VehicleValidationIssue } from '../../domain/vehicles/vehicle';
import {
  createVehicleError,
  createVehicleValidationError,
  type VehicleErrorCategory,
  type VehicleResult,
} from './vehicleResult';

const expectedMessages: Readonly<
  Record<Exclude<VehicleErrorCategory, 'validation'>, string>
> = {
  not_found: 'This Vehicle could not be found.',
  unauthorized: 'You do not have access to manage Vehicles.',
  lifecycle_conflict: 'This Vehicle cannot be changed in its current state.',
  service_record_history_conflict: 'Completed Service Record history prevents this Vehicle change.',
  temporary_failure: 'Vehicles are temporarily unavailable. Please try again.',
};

describe('Vehicle application results', () => {
  it.each(Object.entries(expectedMessages))(
    'creates safe application copy for %s',
    (category, message) => {
      expect(createVehicleError(
        category as Exclude<VehicleErrorCategory, 'validation'>,
      )).toEqual({ category, message });
    },
  );

  it('preserves structured domain validation issues without private input values', () => {
    const issues: readonly VehicleValidationIssue[] = [
      { field: 'make', code: 'required' },
      { field: 'notes', code: 'too_long' },
    ];

    expect(createVehicleValidationError(issues)).toEqual({
      category: 'validation',
      message: 'Some Vehicle details are invalid. Review the highlighted fields.',
      issues,
    });
  });

  it('models success and failure as a discriminated result', () => {
    const success: VehicleResult<string> = { ok: true, value: 'vehicle-1' };
    const failure: VehicleResult<string> = {
      ok: false,
      error: createVehicleError('temporary_failure'),
    };

    expect(success).toEqual({ ok: true, value: 'vehicle-1' });
    expect(failure).toEqual({
      ok: false,
      error: {
        category: 'temporary_failure',
        message: 'Vehicles are temporarily unavailable. Please try again.',
      },
    });
  });
});
