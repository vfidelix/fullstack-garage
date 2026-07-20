import {
  AuthApiError,
  AuthImplicitGrantRedirectError,
  AuthInvalidTokenResponseError,
  AuthPKCEGrantCodeExchangeError,
  AuthRetryableFetchError,
} from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import {
  mapSupabaseAuthenticationError,
  type SupabaseAuthenticationOperation,
} from './mapAuthenticationError';
import type { AuthenticationErrorCategory } from '../../../application/authentication/authenticationError';

interface MappingCase {
  readonly category: AuthenticationErrorCategory;
  readonly error: unknown;
  readonly operation: SupabaseAuthenticationOperation;
}

const expectedMessages: Readonly<Record<AuthenticationErrorCategory, string>> = {
  sign_in_cancelled: 'Sign-in was cancelled.',
  sign_in_unavailable: 'Google sign-in is temporarily unavailable. Please try again.',
  invalid_callback: 'The sign-in link is invalid or has expired. Please try again.',
  session_expired: 'Your session has expired. Please sign in again.',
  provisioning_failed: 'Your Fullstack Garage access could not be verified. Please try again.',
  sign_out_failed: 'Fullstack Garage could not sign you out. Please try again.',
  unexpected: 'Authentication is temporarily unavailable. Please try again.',
};

const cases: readonly MappingCase[] = [
  {
    category: 'sign_in_cancelled',
    error: new AuthImplicitGrantRedirectError('private callback', {
      error: 'access_denied',
      code: 'private-code',
    }),
    operation: 'callback',
  },
  {
    category: 'sign_in_cancelled',
    error: { name: 'AbortError' },
    operation: 'sign_in',
  },
  {
    category: 'sign_in_unavailable',
    error: new AuthRetryableFetchError('private network detail', 503),
    operation: 'sign_in',
  },
  {
    category: 'sign_in_unavailable',
    error: new AuthApiError('private rate detail', 429, 'over_request_rate_limit'),
    operation: 'callback',
  },
  {
    category: 'sign_in_unavailable',
    error: new AuthApiError('private provider detail', 400, 'provider_disabled'),
    operation: 'sign_in',
  },
  {
    category: 'sign_in_unavailable',
    error: new AuthImplicitGrantRedirectError('private provider detail', {
      error: 'temporarily_unavailable',
      code: 'private-code',
    }),
    operation: 'callback',
  },
  {
    category: 'invalid_callback',
    error: new AuthApiError('private callback detail', 400, 'bad_oauth_state'),
    operation: 'callback',
  },
  {
    category: 'invalid_callback',
    error: new AuthPKCEGrantCodeExchangeError('private callback detail'),
    operation: 'callback',
  },
  {
    category: 'invalid_callback',
    error: new AuthInvalidTokenResponseError(),
    operation: 'callback',
  },
  {
    category: 'invalid_callback',
    error: { code: 'flow_state_expired', query: 'code=private' },
    operation: 'callback',
  },
  {
    category: 'session_expired',
    error: new AuthApiError('private session detail', 401, 'session_expired'),
    operation: 'restore',
  },
  {
    category: 'session_expired',
    error: new AuthInvalidTokenResponseError(),
    operation: 'restore',
  },
  {
    category: 'session_expired',
    error: { code: 'refresh_token_not_found', token: 'private-token' },
    operation: 'callback',
  },
  {
    category: 'provisioning_failed',
    error: { code: 'PGRST116', details: 'private profile query' },
    operation: 'profile',
  },
  {
    category: 'session_expired',
    error: { status: 401 },
    operation: 'profile',
  },
  {
    category: 'provisioning_failed',
    error: { status: 500 },
    operation: 'profile',
  },
  {
    category: 'sign_out_failed',
    error: new AuthApiError('private sign-out detail', 503, 'unexpected_failure'),
    operation: 'sign_out',
  },
  {
    category: 'unexpected',
    error: new TypeError('private network detail'),
    operation: 'restore',
  },
];

describe('mapSupabaseAuthenticationError', () => {
  it.each(cases)('maps $operation failure to $category', ({
    category,
    error,
    operation,
  }) => {
    const mappedError = mapSupabaseAuthenticationError(error, operation);

    expect(mappedError).toBeInstanceOf(Error);
    expect(mappedError.category).toBe(category);
    expect(mappedError.message).toBe(expectedMessages[category]);
  });

  it('uses conservative operation fallbacks for unknown failures', () => {
    expect([
      mapSupabaseAuthenticationError(null, 'restore').category,
      mapSupabaseAuthenticationError(null, 'sign_in').category,
      mapSupabaseAuthenticationError(null, 'callback').category,
      mapSupabaseAuthenticationError(null, 'profile').category,
      mapSupabaseAuthenticationError(null, 'sign_out').category,
    ]).toEqual([
      'unexpected',
      'sign_in_unavailable',
      'invalid_callback',
      'provisioning_failed',
      'sign_out_failed',
    ]);
  });

  it('does not retain raw provider fields, payloads, causes, tokens, or queries', () => {
    const privateValue = 'private-provider-value';
    const rawError = {
      cause: new Error(privateValue),
      code: 'unknown_private_code',
      message: privateValue,
      payload: { email: privateValue },
      query: `code=${privateValue}`,
      token: privateValue,
    };

    const mappedError = mapSupabaseAuthenticationError(rawError, 'restore');

    expect(mappedError).toEqual(expect.objectContaining({
      category: 'unexpected',
      message: 'Authentication is temporarily unavailable. Please try again.',
    }));
    expect(Object.hasOwn(mappedError, 'cause')).toBe(false);
    expect(Object.hasOwn(mappedError, 'code')).toBe(false);
    expect(Object.hasOwn(mappedError, 'payload')).toBe(false);
    expect(Object.hasOwn(mappedError, 'query')).toBe(false);
    expect(Object.hasOwn(mappedError, 'token')).toBe(false);
    expect(JSON.stringify(mappedError)).not.toContain(privateValue);
  });
});
