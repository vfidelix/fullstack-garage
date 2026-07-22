import type {
  AccessTokenProvider,
  AccessTokenResult,
} from '../../../application/ports/accessTokenProvider';
import { getSupabaseClient } from '../client';

interface SessionResponse {
  readonly data: {
    readonly session: { readonly access_token?: unknown } | null;
  };
  readonly error: unknown;
}

interface SessionClient {
  readonly auth: {
    getSession(): PromiseLike<SessionResponse>;
  };
}

export class SupabaseAccessTokenProvider implements AccessTokenProvider {
  public constructor(
    private readonly client: SessionClient = getSupabaseClient(),
  ) {}

  public async getAccessToken(): Promise<AccessTokenResult> {
    let response: SessionResponse;

    try {
      response = await this.client.auth.getSession();
    } catch {
      return { status: 'temporary_unavailable' };
    }

    if (response.error !== null) return { status: 'temporary_unavailable' };

    const accessToken = response.data.session?.access_token;
    return typeof accessToken === 'string' && accessToken.length > 0
      ? { status: 'available', accessToken }
      : { status: 'unauthenticated' };
  }
}
