import { describe, expect, it } from 'vitest';
import { getSupabaseBrowserConfig } from './supabaseConfig';

const publishableKey = 'sb_publishable_1234567890abcdef';

function createLegacyKey(role: 'anon' | 'service_role'): string {
  const encode = (value: object) => globalThis.btoa(JSON.stringify(value))
    .replace(/=/gu, '')
    .replace(/\+/gu, '-')
    .replace(/\//gu, '_');

  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ role })}.signature`;
}

function captureConfigurationError(environment: Readonly<Record<string, unknown>>): Error {
  try {
    getSupabaseBrowserConfig(environment);
  } catch (error: unknown) {
    if (error instanceof Error) {
      return error;
    }
  }

  throw new Error('Expected configuration validation to throw an Error.');
}

describe('getSupabaseBrowserConfig', () => {
  it('loads an HTTPS project origin and publishable key', () => {
    expect(getSupabaseBrowserConfig({
      VITE_SUPABASE_URL: ' https://project-ref.supabase.co/ ',
      VITE_SUPABASE_PUBLISHABLE_KEY: ` ${publishableKey} `,
    })).toEqual({
      url: 'https://project-ref.supabase.co',
      publishableKey,
    });
  });

  it.each([
    'http://localhost:54321',
    'http://127.0.0.1:54321',
    'http://[::1]:54321',
  ])('accepts the explicit local HTTP origin %s', (url) => {
    expect(getSupabaseBrowserConfig({
      VITE_SUPABASE_URL: url,
      VITE_SUPABASE_PUBLISHABLE_KEY: publishableKey,
    }).url).toBe(url);
  });

  it('accepts a legacy anonymous JWT in the publishable-key variable', () => {
    const legacyAnonymousKey = createLegacyKey('anon');

    expect(getSupabaseBrowserConfig({
      VITE_SUPABASE_URL: 'https://project-ref.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: legacyAnonymousKey,
    }).publishableKey).toBe(legacyAnonymousKey);
  });

  it.each([
    [{}, 'Supabase URL is not configured.'],
    [{ VITE_SUPABASE_URL: '   ' }, 'Supabase URL is not configured.'],
    [{
      VITE_SUPABASE_URL: 'https://project-ref.supabase.co',
    }, 'Supabase publishable key is not configured.'],
  ])('uses a fixed error for missing configuration', (environment, message) => {
    expect(() => getSupabaseBrowserConfig(environment)).toThrow(message);
  });

  it.each([
    'not-a-url',
    'ftp://project-ref.supabase.co',
    'http://project-ref.supabase.co',
    'http://localhost.example.com:54321',
    'https://user:password@project-ref.supabase.co',
    'https://project-ref.supabase.co/rest/v1',
    'https://project-ref.supabase.co?key=value',
    'https://project-ref.supabase.co#fragment',
  ])('rejects the malformed or unsafe URL %s', (url) => {
    expect(() => getSupabaseBrowserConfig({
      VITE_SUPABASE_URL: url,
      VITE_SUPABASE_PUBLISHABLE_KEY: publishableKey,
    })).toThrow('Supabase URL configuration is invalid.');
  });

  it.each([
    'sb_secret_1234567890abcdef',
    'not-a-publishable-key',
    createLegacyKey('service_role'),
  ])('rejects a secret-like or malformed publishable key', (key) => {
    expect(() => getSupabaseBrowserConfig({
      VITE_SUPABASE_URL: 'https://project-ref.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: key,
    })).toThrow('Supabase publishable key configuration is invalid.');
  });

  it('does not leak rejected configuration values in errors', () => {
    const unsafeUrl = 'https://user:private-password@project-ref.supabase.co';
    const secretKey = 'sb_secret_private-value';

    for (const environment of [
      {
        VITE_SUPABASE_URL: unsafeUrl,
        VITE_SUPABASE_PUBLISHABLE_KEY: publishableKey,
      },
      {
        VITE_SUPABASE_URL: 'https://project-ref.supabase.co',
        VITE_SUPABASE_PUBLISHABLE_KEY: secretKey,
      },
    ]) {
      const error = captureConfigurationError(environment);

      expect(error.message).not.toContain('private');
      expect(error.message).not.toContain(unsafeUrl);
      expect(error.message).not.toContain(secretKey);
    }
  });
});
