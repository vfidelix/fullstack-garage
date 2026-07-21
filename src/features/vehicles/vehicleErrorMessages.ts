import type { VehicleErrorCategory } from '../../application/vehicles/vehicleResult';

const safeVehicleErrorMessages: Readonly<Record<VehicleErrorCategory, string>> = {
  validation: 'Some Vehicle details are invalid. Review the highlighted fields.',
  not_found: 'This Vehicle could not be found.',
  unauthorized: 'You do not have access to manage Vehicles.',
  lifecycle_conflict: 'This Vehicle cannot be changed in its current state.',
  temporary_failure: 'Vehicles are temporarily unavailable. Please try again.',
};

export function getSafeVehicleErrorMessage(category: VehicleErrorCategory): string {
  return safeVehicleErrorMessages[category];
}
