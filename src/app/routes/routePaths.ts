import { resolveSafeReturnPath } from '../../shared/validation/safeReturnPath';

export const SIGN_IN_PATH = '/sign-in';
export const AUTH_CALLBACK_PATH = '/auth/callback';
export const ACCESS_UNAVAILABLE_PATH = '/access-unavailable';
export const DASHBOARD_PATH = '/dashboard';

export function createSignInPath(returnPath: unknown): string {
  const safeReturnPath = resolveSafeReturnPath(returnPath);
  const search = new URLSearchParams({ returnPath: safeReturnPath });

  return `${SIGN_IN_PATH}?${search.toString()}`;
}
