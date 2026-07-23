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
export const NEW_SERVICE_RECORD_PATH = '/vehicles/:vehicleId/service-records/new';
export const SERVICE_RECORD_DETAIL_PATH = '/service-records/:serviceRecordId';
export const SERVICE_RECORD_EDIT_PATH = '/service-records/:serviceRecordId/edit';

export function createVehicleDetailPath(vehicleId: string): string {
  return `${VEHICLES_PATH}/${encodeURIComponent(vehicleId)}`;
}

export function createVehicleEditPath(vehicleId: string): string {
  return `${createVehicleDetailPath(vehicleId)}/edit`;
}

export function createNewServiceRecordPath(vehicleId: string): string {
  return `${createVehicleDetailPath(vehicleId)}/service-records/new`;
}

export function createServiceRecordDetailPath(serviceRecordId: string): string {
  return `/service-records/${encodeURIComponent(serviceRecordId)}`;
}

export function createServiceRecordEditPath(serviceRecordId: string): string {
  return `${createServiceRecordDetailPath(serviceRecordId)}/edit`;
}

export function createSignInPath(returnPath: unknown): string {
  const safeReturnPath = resolveSafeReturnPath(returnPath);
  const search = new URLSearchParams({ returnPath: safeReturnPath });

  return `${SIGN_IN_PATH}?${search.toString()}`;
}
