import type { VehicleValidationIssue } from '../../domain/vehicles/vehicle';

export type VehicleErrorCategory
  = | 'validation'
    | 'not_found'
    | 'unauthorized'
    | 'lifecycle_conflict'
    | 'temporary_failure';

export interface VehicleValidationError {
  readonly category: 'validation';
  readonly message: string;
  readonly issues: readonly VehicleValidationIssue[];
}

export type VehicleOperationErrorCategory = Exclude<
  VehicleErrorCategory,
  'validation'
>;

export interface VehicleOperationError {
  readonly category: VehicleOperationErrorCategory;
  readonly message: string;
}

export type VehicleError = VehicleValidationError | VehicleOperationError;

export type VehicleResult<T>
  = | { readonly ok: true; readonly value: T }
    | { readonly ok: false; readonly error: VehicleError };

const vehicleErrorMessages: Readonly<
  Record<VehicleOperationErrorCategory, string>
> = {
  not_found: 'This Vehicle could not be found.',
  unauthorized: 'You do not have access to manage Vehicles.',
  lifecycle_conflict: 'This Vehicle cannot be changed in its current state.',
  temporary_failure: 'Vehicles are temporarily unavailable. Please try again.',
};

export function createVehicleError(
  category: VehicleOperationErrorCategory,
): VehicleOperationError {
  return {
    category,
    message: vehicleErrorMessages[category],
  };
}

export function createVehicleValidationError(
  issues: readonly VehicleValidationIssue[],
): VehicleValidationError {
  return {
    category: 'validation',
    message: 'Some Vehicle details are invalid. Review the highlighted fields.',
    issues,
  };
}
