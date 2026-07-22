import { resolveSafeReturnPath } from '../../shared/validation/safeReturnPath';

export const SIGN_IN_PATH = '/sign-in';
export const AUTH_CALLBACK_PATH = '/auth/callback';
export const ACCESS_UNAVAILABLE_PATH = '/access-unavailable';
export const REGISTRATION_LOOKUP_PRIVACY_PATH = '/privacy/registration-lookup';
export const DASHBOARD_PATH = '/dashboard';
export const VEHICLES_PATH = '/vehicles';
export const ARCHIVED_VEHICLES_PATH = '/vehicles/archived';
export const NEW_VEHICLE_PATH = '/vehicles/new';
export const VEHICLE_DETAIL_PATH = '/vehicles/:vehicleId';
export const VEHICLE_EDIT_PATH = '/vehicles/:vehicleId/edit';

export function createVehicleDetailPath(vehicleId: string): string {
  return `${VEHICLES_PATH}/${encodeURIComponent(vehicleId)}`;
}

export function createVehicleEditPath(vehicleId: string): string {
  return `${createVehicleDetailPath(vehicleId)}/edit`;
}

export function createSignInPath(returnPath: unknown): string {
  const safeReturnPath = resolveSafeReturnPath(returnPath);
  const search = new URLSearchParams({ returnPath: safeReturnPath });

  return `${SIGN_IN_PATH}?${search.toString()}`;
}
