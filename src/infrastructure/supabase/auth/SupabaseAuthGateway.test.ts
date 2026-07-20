import {
  AuthApiError,
  AuthImplicitGrantRedirectError,
  AuthPKCEGrantCodeExchangeError,
} from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { AuthenticationController } from '../../../application/use-cases/auth/authenticationController';
import { SupabaseAuthGateway } from './SupabaseAuthGateway';

const adminRow = {
  id: '10000000-0000-4000-8000-000000000001',
  display_name: 'Garage Admin',
  role: 'admin',
  created_at: '2026-07-20T01:00:00.000Z',
  updated_at: '2026-07-20T02:00:00.000Z',
};

interface ClientOptions {
  readonly initializationError?: unknown;
  readonly oauthError?: unknown;
  readonly profileData?: unknown;
  readonly profileError?: unknown;
  readonly profileStatus?: number;
  readonly session?: unknown;
  readonly sessionError?: unknown;
  readonly signOutError?: unknown;
}

function createClient(options: ClientOptions = {}) {
  const {
    profileData = [adminRow],
    profileError = null,
    initializationError = null,
    oauthError = null,
    session = { access_token: 'private-session-token' },
    sessionError = null,
    signOutError = null,
  } = options;
  const profileStatus = options.profileStatus
    ?? (profileError === null ? 200 : 500);
  const getSession = vi.fn().mockResolvedValue({
    data: { session },
    error: sessionError,
  });
  const initialize = vi.fn().mockResolvedValue({
    error: initializationError,
  });
  const signInWithOAuth = vi.fn().mockResolvedValue({
    data: {
      provider: 'google',
      url: 'https://provider.example/private-oauth-url',
    },
    error: oauthError,
  });
  const signOut = vi.fn().mockResolvedValue({ error: signOutError });
  const rpc = vi.fn().mockResolvedValue({
    data: profileData,
    error: profileError,
    count: null,
    status: profileStatus,
    statusText: profileStatus === 200 ? 'OK' : 'Error',
  });

  return {
    client: {
      auth: {
        getSession,
        initialize,
        signInWithOAuth,
        signOut,
      },
      rpc,
    },
    getSession,
    initialize,
    rpc,
    signInWithOAuth,
    signOut,
  };
}

describe('SupabaseAuthGateway.restore', () => {
  it('returns unauthenticated without querying a profile when no session exists', async () => {
    const { client, getSession, initialize, rpc } = createClient({ session: null });
    const gateway = new SupabaseAuthGateway(client);

    await expect(gateway.restore()).resolves.toEqual({ status: 'unauthenticated' });
    expect(getSession).toHaveBeenCalledOnce();
    expect(initialize).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('maps the current admin profile from the zero-argument helper', async () => {
    const { client, rpc } = createClient();
    const gateway = new SupabaseAuthGateway(client);

    await expect(gateway.restore()).resolves.toEqual({
      status: 'authenticated',
      user: {
        id: '10000000-0000-4000-8000-000000000001',
        displayName: 'Garage Admin',
        role: 'admin',
        createdAt: '2026-07-20T01:00:00.000Z',
        updatedAt: '2026-07-20T02:00:00.000Z',
      },
    });
    expect(rpc).toHaveBeenCalledWith('get_current_app_user');
    expect(rpc.mock.calls[0]).toHaveLength(1);
  });

  it('returns unauthorized for a valid member profile', async () => {
    const { client } = createClient({
      profileData: [{ ...adminRow, role: 'member' }],
    });

    await expect(new SupabaseAuthGateway(client).restore()).resolves.toEqual({
      status: 'unauthorized',
    });
  });

  it.each([null, []])('returns unauthorized when the helper returns no profile', async (profileData) => {
    const { client } = createClient({ profileData });

    await expect(new SupabaseAuthGateway(client).restore()).resolves.toEqual({
      status: 'unauthorized',
    });
  });

  it.each([
    { ...adminRow, role: 'admin' },
    [adminRow, adminRow],
    [{ ...adminRow, id: 'not-a-uuid' }],
    [{ ...adminRow, display_name: '   ' }],
    [{ ...adminRow, role: 'owner' }],
    [{ ...adminRow, created_at: 'not-a-timestamp' }],
    [{ ...adminRow, updated_at: null }],
  ])('rejects a malformed or unsupported profile result', async (profileData) => {
    const { client } = createClient({ profileData });

    await expect(new SupabaseAuthGateway(client).restore()).rejects.toMatchObject({
      category: 'provisioning_failed',
      message: 'Your Fullstack Garage access could not be verified. Please try again.',
    });
  });

  it('maps a returned expired-session error without leaking provider details', async () => {
    const privateDetail = 'private-refresh-token';
    const { client, rpc } = createClient({
      sessionError: new AuthApiError(privateDetail, 401, 'refresh_token_not_found'),
    });

    await expect(new SupabaseAuthGateway(client).restore()).rejects.toMatchObject({
      category: 'session_expired',
      message: 'Your session has expired. Please sign in again.',
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('maps a thrown session API failure to a safe restore error', async () => {
    const { client, getSession } = createClient();
    getSession.mockRejectedValue(new Error('private session payload'));

    await expect(new SupabaseAuthGateway(client).restore()).rejects.toMatchObject({
      category: 'unexpected',
      message: 'Authentication is temporarily unavailable. Please try again.',
    });
  });

  it('maps a generic profile query error to provisioning failure', async () => {
    const privateDetail = 'private SQL query and token';
    const { client } = createClient({
      profileError: { code: 'PGRST000', message: privateDetail },
      profileStatus: 500,
    });

    const restore = new SupabaseAuthGateway(client).restore();

    await expect(restore).rejects.toMatchObject({
      category: 'provisioning_failed',
      message: 'Your Fullstack Garage access could not be verified. Please try again.',
    });
    await expect(restore).rejects.not.toHaveProperty('cause');
    await expect(restore).rejects.not.toHaveProperty('code');
  });

  it('turns a profile 401 into unauthenticated through the controller path', async () => {
    const { client } = createClient({
      profileError: {
        code: 'PGRST301',
        details: null,
        hint: null,
        message: 'private revoked-session detail',
      },
      profileStatus: 401,
    });
    const controller = new AuthenticationController(new SupabaseAuthGateway(client));

    await expect(controller.restoreAuthentication()).resolves.toEqual({
      status: 'unauthenticated',
    });
  });
});

describe('SupabaseAuthGateway.signInWithGoogle', () => {
  const browserLocation = {
    origin: 'https://garage.example',
    pathname: '/sign-in',
  };

  it('starts Google OAuth with an encoded same-origin callback', async () => {
    const { client, signInWithOAuth } = createClient();
    const gateway = new SupabaseAuthGateway(client, browserLocation);

    await expect(gateway.signInWithGoogle(
      '/vehicles/garage queen?tab=history#latest',
    )).resolves.toBeUndefined();
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        redirectTo: 'https://garage.example/auth/callback?returnPath=%2Fvehicles%2Fgarage+queen%3Ftab%3Dhistory%23latest',
      },
    });
    expect(signInWithOAuth.mock.calls[0]).toHaveLength(1);
  });

  it.each([
    'https://attacker.example/private',
    '//attacker.example/private',
    '/auth/callback?returnPath=/vehicles',
  ])('falls back safely for the return path %s', async (returnPath) => {
    const { client, signInWithOAuth } = createClient();
    const gateway = new SupabaseAuthGateway(client, browserLocation);

    await gateway.signInWithGoogle(returnPath);

    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        redirectTo: 'https://garage.example/auth/callback?returnPath=%2Fdashboard',
      },
    });
  });

  it('maps a returned provider failure without retaining details', async () => {
    const { client } = createClient({
      oauthError: new AuthApiError(
        'private provider payload',
        400,
        'provider_disabled',
      ),
    });

    await expect(
      new SupabaseAuthGateway(client, browserLocation).signInWithGoogle(),
    ).rejects.toMatchObject({
      category: 'sign_in_unavailable',
      message: 'Google sign-in is temporarily unavailable. Please try again.',
    });
  });

  it('maps a thrown cancellation', async () => {
    const { client, signInWithOAuth } = createClient();
    signInWithOAuth.mockRejectedValue({ name: 'AbortError' });

    await expect(
      new SupabaseAuthGateway(client, browserLocation).signInWithGoogle(),
    ).rejects.toMatchObject({
      category: 'sign_in_cancelled',
      message: 'Sign-in was cancelled.',
    });
  });
});

describe('SupabaseAuthGateway callback restore', () => {
  const callbackLocation = {
    origin: 'https://garage.example',
    pathname: '/auth/callback',
  };

  it('maps provider cancellation through callback completion', async () => {
    const { client, getSession, rpc } = createClient({
      initializationError: new AuthImplicitGrantRedirectError('private callback data', {
        error: 'access_denied',
        code: 'private-code',
      }),
    });
    const controller = new AuthenticationController(
      new SupabaseAuthGateway(client, callbackLocation),
    );

    await expect(controller.completeAuthenticationRedirect()).resolves.toEqual({
      status: 'error',
      error: {
        category: 'sign_in_cancelled',
        message: 'Sign-in was cancelled.',
      },
    });
    expect(getSession).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('maps an invalid PKCE callback through callback completion', async () => {
    const { client, getSession, rpc } = createClient({
      initializationError: new AuthPKCEGrantCodeExchangeError('private callback code'),
    });
    const controller = new AuthenticationController(
      new SupabaseAuthGateway(client, callbackLocation),
    );

    await expect(controller.completeAuthenticationRedirect()).resolves.toEqual({
      status: 'error',
      error: {
        category: 'invalid_callback',
        message: 'The sign-in link is invalid or has expired. Please try again.',
      },
    });
    expect(getSession).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('maps a thrown callback initialization failure before session access', async () => {
    const { client, getSession, initialize, rpc } = createClient();
    initialize.mockRejectedValue(new Error('private callback query'));

    await expect(
      new SupabaseAuthGateway(client, callbackLocation).restore(),
    ).rejects.toMatchObject({
      category: 'invalid_callback',
      message: 'The sign-in link is invalid or has expired. Please try again.',
    });
    expect(getSession).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('maps an expired callback session to unauthenticated', async () => {
    const { client } = createClient({
      sessionError: new AuthApiError(
        'private refresh token',
        401,
        'refresh_token_not_found',
      ),
    });
    const controller = new AuthenticationController(
      new SupabaseAuthGateway(client, callbackLocation),
    );

    await expect(controller.completeAuthenticationRedirect()).resolves.toEqual({
      status: 'unauthenticated',
    });
  });

  it('treats a callback without a resulting session as invalid', async () => {
    const { client, getSession, initialize, rpc } = createClient({ session: null });

    await expect(
      new SupabaseAuthGateway(client, callbackLocation).restore(),
    ).rejects.toMatchObject({
      category: 'invalid_callback',
      message: 'The sign-in link is invalid or has expired. Please try again.',
    });
    expect(initialize).toHaveBeenCalledOnce();
    expect(getSession).toHaveBeenCalledOnce();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('continues from successful initialization to restore an existing session', async () => {
    const { client, getSession, initialize, rpc } = createClient();

    await expect(
      new SupabaseAuthGateway(client, callbackLocation).restore(),
    ).resolves.toMatchObject({
      status: 'authenticated',
      user: { role: 'admin' },
    });
    expect(initialize).toHaveBeenCalledOnce();
    expect(getSession).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledOnce();
  });
});

describe('SupabaseAuthGateway.signOut', () => {
  it('signs out only the current Supabase session', async () => {
    const { client, signOut } = createClient();

    await expect(new SupabaseAuthGateway(client).signOut()).resolves.toBeUndefined();
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(signOut.mock.calls[0]).toHaveLength(1);
  });

  it('maps a returned sign-out failure without retaining details', async () => {
    const { client } = createClient({
      signOutError: new AuthApiError(
        'private sign-out token',
        503,
        'unexpected_failure',
      ),
    });

    await expect(new SupabaseAuthGateway(client).signOut()).rejects.toMatchObject({
      category: 'sign_out_failed',
      message: 'Fullstack Garage could not sign you out. Please try again.',
    });
  });

  it('maps a thrown sign-out failure', async () => {
    const { client, signOut } = createClient();
    signOut.mockRejectedValue(new Error('private local storage token'));

    await expect(new SupabaseAuthGateway(client).signOut()).rejects.toMatchObject({
      category: 'sign_out_failed',
      message: 'Fullstack Garage could not sign you out. Please try again.',
    });
  });
});
