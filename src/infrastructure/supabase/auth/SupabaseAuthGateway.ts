import type { AuthenticationResult } from '../../../application/authentication/authenticationModels';
import type { AuthGateway } from '../../../application/ports/authGateway';
import type { AppUser } from '../../../domain/users/appUser';
import { resolveSafeReturnPath } from '../../../shared/validation/safeReturnPath';
import { getSupabaseClient } from '../client';
import {
  mapSupabaseAuthenticationError,
  SupabaseAuthenticationError,
} from './mapAuthenticationError';

interface RestoreSessionResponse {
  readonly data: { readonly session: unknown };
  readonly error: unknown;
}

interface RestoreProfileResponse {
  readonly data: unknown;
  readonly error: unknown;
  readonly status: number;
}

interface OAuthResponse {
  readonly error: unknown;
}

interface SignOutResponse {
  readonly error: unknown;
}

interface InitializationResponse {
  readonly error: unknown;
}

interface AuthenticationClient {
  readonly auth: {
    getSession(): PromiseLike<RestoreSessionResponse>;
    initialize(): PromiseLike<InitializationResponse>;
    signInWithOAuth(options: {
      readonly provider: 'google';
      readonly options: { readonly redirectTo: string };
    }): PromiseLike<OAuthResponse>;
    signOut(options: { readonly scope: 'local' }): PromiseLike<SignOutResponse>;
  };
  rpc(functionName: 'get_current_app_user'): PromiseLike<RestoreProfileResponse>;
}

interface BrowserLocation {
  readonly origin: string;
  readonly pathname: string;
}

const APP_USER_ID_PATTERN = /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/iu;
const AUTH_CALLBACK_PATH = '/auth/callback';

function getBrowserLocation(): BrowserLocation {
  return {
    origin: globalThis.location.origin,
    pathname: globalThis.location.pathname,
  };
}

function isAuthenticationCallback(pathname: string): boolean {
  return pathname.replace(/\/+$/u, '').toLowerCase() === AUTH_CALLBACK_PATH;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTimestamp(value: unknown): value is string {
  return typeof value === 'string'
    && value.trim() !== ''
    && !Number.isNaN(Date.parse(value));
}

function mapAppUserRow(value: unknown): AppUser | null {
  if (
    !isRecord(value)
    || typeof value.id !== 'string'
    || !APP_USER_ID_PATTERN.test(value.id)
    || typeof value.display_name !== 'string'
    || value.display_name.trim() === ''
    || (value.role !== 'admin' && value.role !== 'member')
    || !isTimestamp(value.created_at)
    || !isTimestamp(value.updated_at)
  ) {
    return null;
  }

  return {
    id: value.id,
    displayName: value.display_name,
    role: value.role,
    createdAt: value.created_at,
    updatedAt: value.updated_at,
  };
}

export class SupabaseAuthGateway implements AuthGateway {
  public constructor(
    private readonly client: AuthenticationClient = getSupabaseClient(),
    private readonly browserLocation: BrowserLocation = getBrowserLocation(),
  ) {}

  public async restore(): Promise<AuthenticationResult> {
    const operation = isAuthenticationCallback(this.browserLocation.pathname)
      ? 'callback'
      : 'restore';

    if (operation === 'callback') {
      let initializationResponse: Awaited<
        ReturnType<AuthenticationClient['auth']['initialize']>
      >;

      try {
        initializationResponse = await this.client.auth.initialize();
      } catch (error: unknown) {
        throw mapSupabaseAuthenticationError(error, 'callback');
      }

      if (initializationResponse.error !== null) {
        throw mapSupabaseAuthenticationError(
          initializationResponse.error,
          'callback',
        );
      }
    }

    let sessionResponse: Awaited<
      ReturnType<AuthenticationClient['auth']['getSession']>
    >;

    try {
      sessionResponse = await this.client.auth.getSession();
    } catch (error: unknown) {
      throw mapSupabaseAuthenticationError(error, operation);
    }

    if (sessionResponse.error !== null) {
      throw mapSupabaseAuthenticationError(sessionResponse.error, operation);
    }

    if (sessionResponse.data.session === null) {
      if (operation === 'callback') {
        throw new SupabaseAuthenticationError('invalid_callback');
      }

      return { status: 'unauthenticated' };
    }

    let profileResponse: Awaited<ReturnType<AuthenticationClient['rpc']>>;

    try {
      profileResponse = await this.client.rpc('get_current_app_user');
    } catch (error: unknown) {
      throw mapSupabaseAuthenticationError(error, 'profile');
    }

    if (profileResponse.error !== null) {
      throw mapSupabaseAuthenticationError(
        { status: profileResponse.status },
        'profile',
      );
    }

    if (
      profileResponse.data === null
      || (Array.isArray(profileResponse.data) && profileResponse.data.length === 0)
    ) {
      return { status: 'unauthorized' };
    }

    if (!Array.isArray(profileResponse.data) || profileResponse.data.length !== 1) {
      throw new SupabaseAuthenticationError('provisioning_failed');
    }

    const user = mapAppUserRow(profileResponse.data[0]);

    if (user === null) {
      throw new SupabaseAuthenticationError('provisioning_failed');
    }

    if (user.role !== 'admin') {
      return { status: 'unauthorized' };
    }

    return { status: 'authenticated', user };
  }

  public async signInWithGoogle(returnPath?: string): Promise<void> {
    const callbackUrl = new URL(AUTH_CALLBACK_PATH, this.browserLocation.origin);

    callbackUrl.searchParams.set('returnPath', resolveSafeReturnPath(returnPath));

    let response: Awaited<
      ReturnType<AuthenticationClient['auth']['signInWithOAuth']>
    >;

    try {
      response = await this.client.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: callbackUrl.toString() },
      });
    } catch (error: unknown) {
      throw mapSupabaseAuthenticationError(error, 'sign_in');
    }

    if (response.error !== null) {
      throw mapSupabaseAuthenticationError(response.error, 'sign_in');
    }
  }

  public async signOut(): Promise<void> {
    let response: Awaited<ReturnType<AuthenticationClient['auth']['signOut']>>;

    try {
      response = await this.client.auth.signOut({ scope: 'local' });
    } catch (error: unknown) {
      throw mapSupabaseAuthenticationError(error, 'sign_out');
    }

    if (response.error !== null) {
      throw mapSupabaseAuthenticationError(response.error, 'sign_out');
    }
  }
}
