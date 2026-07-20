import {
  AuthApiError,
  AuthImplicitGrantRedirectError,
  AuthPKCEGrantCodeExchangeError,
  AuthRetryableFetchError,
} from '@supabase/supabase-js';
import { vi } from 'vitest';
import {
  describeAuthGatewayContract,
  type AuthGatewayContractHarness,
  type AuthGatewayContractScenario,
} from '../../../application/ports/authGateway.contract';
import type { AppUser } from '../../../domain/users/appUser';
import { SupabaseAuthGateway } from './SupabaseAuthGateway';

const adminRow = {
  id: '10000000-0000-4000-8000-000000000001',
  display_name: 'Garage Admin',
  role: 'admin',
  created_at: '2026-07-20T01:00:00.000Z',
  updated_at: '2026-07-20T02:00:00.000Z',
};

const expectedAdmin: AppUser = {
  id: adminRow.id,
  displayName: adminRow.display_name,
  role: 'admin',
  createdAt: adminRow.created_at,
  updatedAt: adminRow.updated_at,
};

interface OAuthOptions {
  readonly provider: 'google';
  readonly options: { readonly redirectTo: string };
}

function createFailure(
  scenario: AuthGatewayContractScenario | undefined,
): unknown {
  const failure = scenario?.failure;

  if (failure === undefined) {
    return null;
  }

  switch (failure.category) {
    case 'sign_in_cancelled':
      return failure.operation === 'callback'
        ? new AuthImplicitGrantRedirectError(failure.privateMarker, {
            error: 'access_denied',
            code: failure.privateMarker,
          })
        : { name: 'AbortError', payload: failure.privateMarker };
    case 'sign_in_unavailable':
      return new AuthRetryableFetchError(failure.privateMarker, 503);
    case 'invalid_callback':
      return new AuthPKCEGrantCodeExchangeError(failure.privateMarker);
    case 'session_expired':
      return new AuthApiError(
        failure.privateMarker,
        401,
        'refresh_token_not_found',
      );
    case 'sign_out_failed':
      return new AuthApiError(
        failure.privateMarker,
        503,
        'unexpected_failure',
      );
    case 'provisioning_failed':
    case 'unexpected':
      return new Error(failure.privateMarker);
  }
}

function createSupabaseHarness(
  scenario?: AuthGatewayContractScenario,
): AuthGatewayContractHarness {
  const failure = createFailure(scenario);
  const restore = scenario?.restore ?? 'authenticated_admin';
  const session = restore === 'unauthenticated'
    ? null
    : { access_token: 'harness-private-session' };
  const profileData = restore === 'unauthorized'
    ? []
    : [{ ...adminRow, role: restore === 'member' ? 'member' : 'admin' }];
  const failureOperation = scenario?.failure?.operation;
  const isCallback = failureOperation === 'callback'
    || scenario?.restoreContext === 'callback';
  const initialize = vi.fn().mockResolvedValue({
    error: failureOperation === 'callback' ? failure : null,
  });
  const getSession = vi.fn().mockResolvedValue({
    data: { session },
    error: failureOperation === 'restore' ? failure : null,
  });
  let forwardedReturnPath: string | null = null;
  const signInWithOAuth = vi.fn((options: OAuthOptions) => {
    forwardedReturnPath = new URL(options.options.redirectTo)
      .searchParams.get('returnPath');

    return Promise.resolve({
      data: { provider: 'google', url: 'https://provider.example/oauth' },
      error: failureOperation === 'sign_in' ? failure : null,
    });
  });
  const signOut = vi.fn().mockResolvedValue({
    error: failureOperation === 'sign_out' ? failure : null,
  });
  const rpc = vi.fn().mockResolvedValue({
    data: profileData,
    error: failureOperation === 'profile'
      ? {
          code: 'PGRST000',
          details: null,
          hint: null,
          message: scenario?.failure?.privateMarker,
        }
      : null,
    count: null,
    status: failureOperation === 'profile' ? 500 : 200,
    statusText: failureOperation === 'profile' ? 'Internal Server Error' : 'OK',
  });
  const browserLocation = {
    origin: 'https://garage.example',
    pathname: isCallback ? '/auth/callback' : '/sign-in',
  };
  const gateway = new SupabaseAuthGateway({
    auth: {
      getSession,
      initialize,
      signInWithOAuth,
      signOut,
    },
    rpc,
  }, browserLocation);

  return {
    expectedAdmin,
    gateway,
    readForwardedReturnPath: () => forwardedReturnPath,
  };
}

describeAuthGatewayContract('SupabaseAuthGateway', createSupabaseHarness);
