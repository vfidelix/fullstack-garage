export interface SupabaseBrowserConfig {
  readonly publishableKey: string;
  readonly url: string;
}

type BrowserEnvironment = Readonly<Record<string, unknown>>;

const LOCAL_HTTP_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);
const PUBLISHABLE_KEY_PATTERN = /^sb_publishable_[a-z\d_-]{16,}$/iu;

function readRequiredString(
  environment: BrowserEnvironment,
  name: 'VITE_SUPABASE_PUBLISHABLE_KEY' | 'VITE_SUPABASE_URL',
  missingMessage: string,
): string {
  const value = environment[name];

  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(missingMessage);
  }

  return value.trim();
}

function validateSupabaseUrl(value: string): string {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error('Supabase URL configuration is invalid.');
  }

  const isHttps = url.protocol === 'https:';
  const isLocalHttp = url.protocol === 'http:'
    && LOCAL_HTTP_HOSTNAMES.has(url.hostname);

  if (
    (!isHttps && !isLocalHttp)
    || url.username !== ''
    || url.password !== ''
    || url.pathname !== '/'
    || url.search !== ''
    || url.hash !== ''
  ) {
    throw new Error('Supabase URL configuration is invalid.');
  }

  return url.origin;
}

function decodeJwtRole(value: string): unknown {
  const segments = value.split('.');
  const payload = segments[1];

  if (segments.length !== 3 || payload === undefined || payload === '') {
    return null;
  }

  try {
    const normalizedPayload = payload.replace(/-/gu, '+').replace(/_/gu, '/');
    const paddedPayload = normalizedPayload.padEnd(
      normalizedPayload.length + ((4 - normalizedPayload.length % 4) % 4),
      '=',
    );
    const parsed: unknown = JSON.parse(globalThis.atob(paddedPayload));

    if (typeof parsed !== 'object' || parsed === null || !('role' in parsed)) {
      return null;
    }

    return parsed.role;
  } catch {
    return null;
  }
}

function validatePublishableKey(value: string): string {
  if (
    !PUBLISHABLE_KEY_PATTERN.test(value)
    && decodeJwtRole(value) !== 'anon'
  ) {
    throw new Error('Supabase publishable key configuration is invalid.');
  }

  return value;
}

export function validateSupabaseBrowserConfig(
  environment: BrowserEnvironment,
): SupabaseBrowserConfig {
  const url = readRequiredString(
    environment,
    'VITE_SUPABASE_URL',
    'Supabase URL is not configured.',
  );
  const publishableKey = readRequiredString(
    environment,
    'VITE_SUPABASE_PUBLISHABLE_KEY',
    'Supabase publishable key is not configured.',
  );

  return {
    publishableKey: validatePublishableKey(publishableKey),
    url: validateSupabaseUrl(url),
  };
}
