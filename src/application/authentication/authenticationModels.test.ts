import { describe, expect, it } from 'vitest';
import type { AppUser } from '../../domain/users/appUser';
import type { AuthGateway } from '../ports/authGateway';
import { createAuthenticationError } from './authenticationError';
import type {
  AuthenticationResult,
  AuthenticationState,
} from './authenticationModels';

const appUser: AppUser = {
  id: '2dc6ce1b-03a9-4c79-a658-0459528a4d4c',
  displayName: 'Garage Operator',
  role: 'admin',
  createdAt: '2026-07-20T00:00:00.000Z',
  updatedAt: '2026-07-20T00:00:00.000Z',
};

describe('authentication contracts', () => {
  it('represent every application authentication state', () => {
    const states: readonly AuthenticationState[] = [
      { status: 'initializing' },
      { status: 'unauthenticated' },
      { status: 'authenticated', user: appUser },
      { status: 'unauthorized' },
      { status: 'error', error: createAuthenticationError('unexpected') },
    ];

    expect(states.map(({ status }) => status)).toEqual([
      'initializing',
      'unauthenticated',
      'authenticated',
      'unauthorized',
      'error',
    ]);
  });

  it('allows a provider-neutral gateway to return app-owned results', async () => {
    const authenticatedResult: AuthenticationResult = {
      status: 'authenticated',
      user: appUser,
    };
    const gateway: AuthGateway = {
      restore: () => Promise.resolve(authenticatedResult),
      signInWithGoogle: () => Promise.resolve(),
      signOut: () => Promise.resolve(),
    };

    await expect(gateway.restore()).resolves.toEqual(authenticatedResult);
  });
});
