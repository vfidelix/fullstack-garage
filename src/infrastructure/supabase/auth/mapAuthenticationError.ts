import {
  isAuthError,
  isAuthImplicitGrantRedirectError,
  isAuthRetryableFetchError,
} from '@supabase/supabase-js';
import {
  createAuthenticationError,
  type AuthenticationErrorCategory,
} from '../../../application/authentication/authenticationError';

export type SupabaseAuthenticationOperation
  = | 'restore'
    | 'sign_in'
    | 'callback'
    | 'profile'
    | 'sign_out';

const CANCELLED_CODES = new Set(['access_denied', 'oauth_access_denied']);
const INVALID_CALLBACK_CODES = new Set([
  'bad_code_verifier',
  'bad_oauth_callback',
  'bad_oauth_state',
  'flow_state_expired',
  'flow_state_not_found',
  'pkce_code_verifier_not_found',
]);
const INVALID_CALLBACK_NAMES = new Set([
  'AuthImplicitGrantRedirectError',
  'AuthPKCECodeVerifierMissingError',
  'AuthPKCEGrantCodeExchangeError',
]);
const SESSION_CODES = new Set([
  'bad_jwt',
  'invalid_jwt',
  'refresh_token_already_used',
  'refresh_token_not_found',
  'session_expired',
  'session_not_found',
]);
const SESSION_ERROR_NAMES = new Set([
  'AuthInvalidJwtError',
  'AuthSessionMissingError',
]);
const TEMPORARY_CODES = new Set([
  'hook_timeout',
  'hook_timeout_after_retry',
  'oauth_provider_not_supported',
  'over_email_send_rate_limit',
  'over_request_rate_limit',
  'over_sms_send_rate_limit',
  'provider_disabled',
  'request_timeout',
  'unexpected_failure',
]);
const TEMPORARY_OAUTH_ERRORS = new Set([
  'server_error',
  'temporarily_unavailable',
]);

interface ErrorFacts {
  readonly code: string | null;
  readonly name: string | null;
  readonly status: number | null;
}

export class SupabaseAuthenticationError extends Error {
  public readonly category: AuthenticationErrorCategory;

  public constructor(category: AuthenticationErrorCategory) {
    const mappedError = createAuthenticationError(category);

    super(mappedError.message);
    this.name = 'SupabaseAuthenticationError';
    this.category = mappedError.category;
  }
}

function readErrorFacts(error: unknown): ErrorFacts {
  if (isAuthError(error)) {
    return {
      code: typeof error.code === 'string' ? error.code : null,
      name: error.name,
      status: typeof error.status === 'number' ? error.status : null,
    };
  }

  if (typeof error !== 'object' || error === null) {
    return { code: null, name: null, status: null };
  }

  return {
    code: 'code' in error && typeof error.code === 'string' ? error.code : null,
    name: 'name' in error && typeof error.name === 'string' ? error.name : null,
    status: 'status' in error && typeof error.status === 'number'
      ? error.status
      : null,
  };
}

function isCancellation(error: unknown, facts: ErrorFacts): boolean {
  if (facts.name === 'AbortError' || (facts.code !== null && CANCELLED_CODES.has(facts.code))) {
    return true;
  }

  return isAuthImplicitGrantRedirectError(error)
    && error.details?.error === 'access_denied';
}

function isExplicitTemporaryFailure(error: unknown, facts: ErrorFacts): boolean {
  return isAuthRetryableFetchError(error)
    || (
      isAuthImplicitGrantRedirectError(error)
      && error.details !== null
      && TEMPORARY_OAUTH_ERRORS.has(error.details.error)
    )
    || (facts.code !== null && TEMPORARY_CODES.has(facts.code));
}

function hasTemporaryStatus(facts: ErrorFacts): boolean {
  return facts.status === 408
    || facts.status === 429
    || (facts.status !== null && facts.status >= 500);
}

function fallbackCategory(
  operation: SupabaseAuthenticationOperation,
): AuthenticationErrorCategory {
  switch (operation) {
    case 'sign_in':
      return 'sign_in_unavailable';
    case 'callback':
      return 'invalid_callback';
    case 'restore':
      return 'unexpected';
    case 'profile':
      return 'provisioning_failed';
    case 'sign_out':
      return 'sign_out_failed';
  }
}

export function mapSupabaseAuthenticationError(
  error: unknown,
  operation: SupabaseAuthenticationOperation,
): SupabaseAuthenticationError {
  if (operation === 'sign_out') {
    return new SupabaseAuthenticationError(fallbackCategory(operation));
  }

  const facts = readErrorFacts(error);

  if (operation === 'profile') {
    const isExpiredSession = facts.status === 401
      || facts.name === 'AuthInvalidTokenResponseError'
      || (facts.code !== null && SESSION_CODES.has(facts.code))
      || (facts.name !== null && SESSION_ERROR_NAMES.has(facts.name));

    return new SupabaseAuthenticationError(
      isExpiredSession ? 'session_expired' : 'provisioning_failed',
    );
  }

  if (
    (operation === 'sign_in' || operation === 'callback')
    && isCancellation(error, facts)
  ) {
    return new SupabaseAuthenticationError('sign_in_cancelled');
  }

  if (facts.name === 'AuthInvalidTokenResponseError') {
    const category = operation === 'callback'
      ? 'invalid_callback'
      : operation === 'restore'
        ? 'session_expired'
        : fallbackCategory(operation);

    return new SupabaseAuthenticationError(category);
  }

  if (isExplicitTemporaryFailure(error, facts)) {
    return new SupabaseAuthenticationError(
      operation === 'restore' ? 'unexpected' : 'sign_in_unavailable',
    );
  }

  if (
    operation === 'callback'
    && (
      (facts.code !== null && INVALID_CALLBACK_CODES.has(facts.code))
      || (facts.name !== null && INVALID_CALLBACK_NAMES.has(facts.name))
    )
  ) {
    return new SupabaseAuthenticationError('invalid_callback');
  }

  if (
    (facts.code !== null && SESSION_CODES.has(facts.code))
    || (facts.name !== null && SESSION_ERROR_NAMES.has(facts.name))
  ) {
    return new SupabaseAuthenticationError('session_expired');
  }

  if (hasTemporaryStatus(facts)) {
    return new SupabaseAuthenticationError(
      operation === 'restore' ? 'unexpected' : 'sign_in_unavailable',
    );
  }

  return new SupabaseAuthenticationError(fallbackCategory(operation));
}
