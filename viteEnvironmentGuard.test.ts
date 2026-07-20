import { describe, expect, it } from 'vitest';
import { assertOnlyApprovedPublicEnvironment } from './viteEnvironmentGuard';

function createLegacyKey(role: 'anon' | 'service_role'): string {
  const encode = (value: object) => globalThis.btoa(JSON.stringify(value))
    .replace(/=/gu, '')
    .replace(/\+/gu, '-')
    .replace(/\//gu, '_');

  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ role })}.signature`;
}

describe('assertOnlyApprovedPublicEnvironment', () => {
  it('allows the two approved public Supabase variables', () => {
    expect(() => {
      assertOnlyApprovedPublicEnvironment({
        VITE_SUPABASE_URL: 'https://project-ref.supabase.co',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_1234567890abcdef',
      });
    }).not.toThrow();
  });

  it.each([
    'VITE_UNKNOWN',
    'VITE_SUPABASE_SERVICE_ROLE_KEY',
    'VITE_SUPABASE_SECRET_KEY',
    'VITE_GOOGLE_CLIENT_SECRET',
    'VITE_PRIVATE_TOKEN',
    'VITE_DATABASE_PASSWORD',
    'VITE_EXTERNAL_API_KEY',
  ])('rejects the unapproved public variable name %s even when blank', (name) => {
    expect(() => {
      assertOnlyApprovedPublicEnvironment({
        [name]: '',
      });
    }).toThrow('Unsupported public environment variable is configured.');
  });

  it('ignores non-Vite process variables', () => {
    expect(() => {
      assertOnlyApprovedPublicEnvironment({
        DATABASE_PASSWORD: 'server-only-value',
        NODE_ENV: 'production',
        SUPABASE_SERVICE_ROLE_KEY: 'server-only-value',
      });
    }).not.toThrow();
  });

  it.each([
    'sb_secret_1234567890abcdef',
    createLegacyKey('service_role'),
  ])('rejects a privileged key before Vite can embed it', (key) => {
    expect(() => {
      assertOnlyApprovedPublicEnvironment({
        VITE_SUPABASE_URL: 'https://project-ref.supabase.co',
        VITE_SUPABASE_PUBLISHABLE_KEY: key,
      });
    }).toThrow('Supabase publishable key configuration is invalid.');
  });

  it('rejects credentials in the public URL before Vite can embed them', () => {
    expect(() => {
      assertOnlyApprovedPublicEnvironment({
        VITE_SUPABASE_URL: 'https://operator:private@project-ref.supabase.co',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_1234567890abcdef',
      });
    }).toThrow('Supabase URL configuration is invalid.');
  });

  it('requires complete public Supabase configuration when either value exists', () => {
    expect(() => {
      assertOnlyApprovedPublicEnvironment({
        VITE_SUPABASE_URL: 'https://project-ref.supabase.co',
      });
    }).toThrow('Supabase publishable key is not configured.');
  });

  it('does not leak a forbidden variable value in its error', () => {
    const secretValue = 'private-service-role-value';

    try {
      assertOnlyApprovedPublicEnvironment({
        VITE_SUPABASE_SERVICE_ROLE_KEY: secretValue,
      });
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).not.toContain(secretValue);
      return;
    }

    throw new Error('Expected the public environment guard to reject a secret.');
  });
});
