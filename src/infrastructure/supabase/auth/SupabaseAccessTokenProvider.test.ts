import { describe, expect, it } from 'vitest';
import { SupabaseAccessTokenProvider } from './SupabaseAccessTokenProvider';

describe('SupabaseAccessTokenProvider', () => {
  it('returns the current session access token', async () => {
    const provider = new SupabaseAccessTokenProvider({
      auth: {
        getSession: () => Promise.resolve({
          data: { session: { access_token: 'session-token' } },
          error: null,
        }),
      },
    });

    await expect(provider.getAccessToken()).resolves.toEqual({
      status: 'available',
      accessToken: 'session-token',
    });
  });

  it('returns unauthenticated when there is no current session', async () => {
    const provider = new SupabaseAccessTokenProvider({
      auth: {
        getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      },
    });

    await expect(provider.getAccessToken()).resolves.toEqual({
      status: 'unauthenticated',
    });
  });

  it('normalizes a session response error without exposing it', async () => {
    const provider = new SupabaseAccessTokenProvider({
      auth: {
        getSession: () => Promise.resolve({
          data: { session: null },
          error: { message: 'private vendor detail' },
        }),
      },
    });

    await expect(provider.getAccessToken()).resolves.toEqual({
      status: 'temporary_unavailable',
    });
  });

  it('normalizes a rejected session request without exposing it', async () => {
    const provider = new SupabaseAccessTokenProvider({
      auth: {
        getSession: () => Promise.reject(new Error('private vendor detail')),
      },
    });

    await expect(provider.getAccessToken()).resolves.toEqual({
      status: 'temporary_unavailable',
    });
  });
});
