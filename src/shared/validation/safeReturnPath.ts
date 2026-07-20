export const DEFAULT_RETURN_PATH = '/dashboard';

const AUTH_CALLBACK_PATH = '/auth/callback';
const VALIDATION_ORIGIN = 'https://fullstack-garage.local';
const SCHEME_PATTERN = /^[a-z][a-z\d+.-]*:/iu;

function containsControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const characterCode = value.charCodeAt(index);

    if (characterCode <= 31 || characterCode === 127) {
      return true;
    }
  }

  return false;
}

function decodeForValidation(value: string): string | null {
  let decoded = value;

  for (let pass = 0; pass < value.length; pass += 1) {
    let next: string;

    try {
      next = decodeURIComponent(decoded);
    } catch {
      return pass === 0 ? null : decoded;
    }

    if (next === decoded) {
      return decoded;
    }

    decoded = next;
  }

  return null;
}

function isAuthenticationCallback(pathname: string): boolean {
  const normalizedPathname = pathname
    .replace(/\/{2,}/gu, '/')
    .replace(/\/+$/u, '')
    .toLowerCase();

  return normalizedPathname === AUTH_CALLBACK_PATH
    || normalizedPathname.startsWith(`${AUTH_CALLBACK_PATH}/`);
}

export function isSafeReturnPath(value: unknown): value is string {
  if (
    typeof value !== 'string'
    || value.length === 0
    || !value.startsWith('/')
    || value.startsWith('//')
    || value.includes('\\')
    || containsControlCharacter(value)
  ) {
    return false;
  }

  const decoded = decodeForValidation(value);

  if (
    decoded === null
    || decoded.startsWith('//')
    || decoded.includes('\\')
    || containsControlCharacter(decoded)
    || SCHEME_PATTERN.test(decoded.replace(/^\/+/, ''))
  ) {
    return false;
  }

  try {
    const parsed = new URL(decoded, VALIDATION_ORIGIN);

    return parsed.origin === VALIDATION_ORIGIN
      && !isAuthenticationCallback(parsed.pathname);
  } catch {
    return false;
  }
}

export function resolveSafeReturnPath(value: unknown): string {
  return isSafeReturnPath(value) ? value : DEFAULT_RETURN_PATH;
}
