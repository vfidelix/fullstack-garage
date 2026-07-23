import { describe, expect, it } from 'vitest';
import {
  createAuthenticationError,
  type AuthenticationErrorCategory,
} from '../../authentication/authenticationError';
import type { AuthenticationResult } from '../../authentication/authenticationModels';
import type { AuthGateway } from '../../ports/authGateway';
import { isGarageAdmin, type AppUser } from '../../../domain/users/appUser';
import { DEFAULT_RETURN_PATH } from '../../../shared/validation/safeReturnPath';
import { AuthenticationController } from './authenticationController';

const appUser: AppUser = {
  id: '2dc6ce1b-03a9-4c79-a658-0459528a4d4c',
  displayName: 'Garage Operator',
  role: 'admin',
  createdAt: '2026-07-20T00:00:00.000Z',
  updatedAt: '2026-07-20T00:00:00.000Z',
};

const memberUser: AppUser = {
  ...appUser,
  id: 'b0f12693-0da7-4eb4-859c-2312a32f9c11',
  displayName: 'Reserved Member',
  role: 'member',
};

function createGateway(
  overrides: Partial<AuthGateway> = {},
): AuthGateway {
  return {
    restore: () => Promise.resolve({ status: 'unauthenticated' }),
    signInWithGoogle: () => Promise.resolve(),
    signOut: () => Promise.resolve(),
    ...overrides,
  };
}

function createDeferred<T>(): {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
  readonly reject: (reason?: unknown) => void;
} {
  let settlement: {
    readonly resolve: (value: T) => void;
    readonly reject: (reason?: unknown) => void;
  } | undefined;
  const promise = new Promise<T>((resolve, reject) => {
    settlement = { resolve, reject };
  });

  if (!settlement) {
    throw new Error('Deferred promise settlement was not initialized.');
  }

  return { promise, ...settlement };
}

function createCategorizedFailure(
  category: AuthenticationErrorCategory,
): Error & { readonly category: AuthenticationErrorCategory } {
  return Object.assign(new Error('provider details'), { category });
}

describe('AuthenticationController', () => {
  it.each<AuthenticationResult>([
    { status: 'unauthenticated' },
    { status: 'unauthorized' },
    { status: 'authenticated', user: appUser },
  ])('restores the $status gateway result', async (result) => {
    const controller = new AuthenticationController(createGateway({
      restore: () => Promise.resolve(result),
    }));

    await expect(controller.restoreAuthentication()).resolves.toEqual(result);
    expect(controller.state).toEqual(result);
  });

  it('returns the current application user only while authenticated', async () => {
    const controller = new AuthenticationController(createGateway({
      restore: () => Promise.resolve({ status: 'authenticated', user: appUser }),
    }));

    expect(controller.getCurrentAppUser()).toBeNull();
    await controller.restoreAuthentication();
    expect(controller.getCurrentAppUser()).toBe(appUser);
  });

  it('keeps an authenticated same user visible while background reconciliation is pending', async () => {
    const reconciliation = createDeferred<AuthenticationResult>();
    const controller = new AuthenticationController(createGateway({
      restore: (() => {
        let calls = 0;
        return () => (++calls === 1
          ? Promise.resolve({ status: 'authenticated', user: appUser })
          : reconciliation.promise);
      })(),
    }));
    await controller.restoreAuthentication();

    const result = controller.reconcileAuthentication();

    expect(controller.state).toEqual({ status: 'authenticated', user: appUser });
    reconciliation.resolve({ status: 'authenticated', user: appUser });
    await expect(result).resolves.toEqual({ status: 'authenticated', user: appUser });
  });

  it('validates the return path before starting Google sign-in', async () => {
    let receivedReturnPath: string | undefined;
    const controller = new AuthenticationController(createGateway({
      signInWithGoogle: (returnPath) => {
        receivedReturnPath = returnPath;
        return Promise.resolve();
      },
    }));

    await controller.signInWithGoogle('https://attacker.example/garage');

    expect(receivedReturnPath).toBe(DEFAULT_RETURN_PATH);
    expect(controller.state).toEqual({ status: 'initializing' });
  });

  it('preserves a validated deep link for Google sign-in', async () => {
    let receivedReturnPath: string | undefined;
    const controller = new AuthenticationController(createGateway({
      signInWithGoogle: (returnPath) => {
        receivedReturnPath = returnPath;
        return Promise.resolve();
      },
    }));

    await controller.signInWithGoogle('/vehicles/garage?tab=history#latest');

    expect(receivedReturnPath).toBe('/vehicles/garage?tab=history#latest');
  });

  it('maps sign-in cancellation to fixed application-owned error copy', async () => {
    const cancelledError = Object.assign(new Error('raw provider payload'), {
      category: 'sign_in_cancelled' as const,
    });
    const controller = new AuthenticationController(createGateway({
      signInWithGoogle: () => Promise.reject(cancelledError),
    }));

    await expect(controller.signInWithGoogle()).resolves.toEqual({
      status: 'error',
      error: createAuthenticationError('sign_in_cancelled'),
    });
  });

  it('uses a safe fallback error for an unknown sign-in failure', async () => {
    const controller = new AuthenticationController(createGateway({
      signInWithGoogle: () => Promise.reject(new Error('provider details')),
    }));

    await expect(controller.signInWithGoogle()).resolves.toEqual({
      status: 'error',
      error: createAuthenticationError('sign_in_unavailable'),
    });
  });

  it('restores authentication after callback completion', async () => {
    const controller = new AuthenticationController(createGateway({
      restore: () => Promise.resolve({ status: 'authenticated', user: appUser }),
    }));

    await expect(controller.completeAuthenticationRedirect()).resolves.toEqual({
      status: 'authenticated',
      user: appUser,
    });
  });

  it('maps an unknown callback failure to a safe invalid-callback error', async () => {
    const controller = new AuthenticationController(createGateway({
      restore: () => Promise.reject(new Error('callback query parameters')),
    }));

    await expect(controller.completeAuthenticationRedirect()).resolves.toEqual({
      status: 'error',
      error: createAuthenticationError('invalid_callback'),
    });
  });

  it('recovers an expired session as unauthenticated', async () => {
    const expiredSessionError = Object.assign(new Error('provider details'), {
      category: 'session_expired' as const,
    });
    const controller = new AuthenticationController(createGateway({
      restore: () => Promise.reject(expiredSessionError),
    }));

    await expect(controller.restoreAuthentication()).resolves.toEqual({
      status: 'unauthenticated',
    });
  });

  it('signs out to unauthenticated state', async () => {
    const controller = new AuthenticationController(createGateway());

    await expect(controller.signOut()).resolves.toEqual({
      status: 'unauthenticated',
    });
    expect(controller.getCurrentAppUser()).toBeNull();
  });

  it('maps sign-out failure without retaining user or provider details', async () => {
    const controller = new AuthenticationController(createGateway({
      restore: () => Promise.resolve({ status: 'authenticated', user: appUser }),
      signOut: () => Promise.reject(new Error('remote provider error')),
    }));
    await controller.restoreAuthentication();

    await expect(controller.signOut()).resolves.toEqual({
      status: 'error',
      error: createAuthenticationError('sign_out_failed'),
    });
    expect(controller.getCurrentAppUser()).toBeNull();
  });

  it('does not allow a pending restore to re-authenticate after sign-out', async () => {
    const pendingRestore = createDeferred<AuthenticationResult>();
    const controller = new AuthenticationController(createGateway({
      restore: () => pendingRestore.promise,
    }));

    const restoreResult = controller.restoreAuthentication();
    await expect(controller.signOut()).resolves.toEqual({
      status: 'unauthenticated',
    });
    pendingRestore.resolve({ status: 'authenticated', user: appUser });

    await expect(restoreResult).resolves.toEqual({ status: 'unauthenticated' });
    expect(controller.state).toEqual({ status: 'unauthenticated' });
  });

  it('ignores an older restore result after a newer restore completes', async () => {
    const olderRestore = createDeferred<AuthenticationResult>();
    const newerRestore = createDeferred<AuthenticationResult>();
    let restoreCount = 0;
    const controller = new AuthenticationController(createGateway({
      restore: () => {
        restoreCount += 1;
        return restoreCount === 1 ? olderRestore.promise : newerRestore.promise;
      },
    }));

    const olderResult = controller.restoreAuthentication();
    const newerResult = controller.restoreAuthentication();
    newerRestore.resolve({ status: 'unauthorized' });
    await expect(newerResult).resolves.toEqual({ status: 'unauthorized' });
    olderRestore.resolve({ status: 'authenticated', user: appUser });

    await expect(olderResult).resolves.toEqual({ status: 'unauthorized' });
    expect(controller.state).toEqual({ status: 'unauthorized' });
  });

  it('ignores an older restore error after a newer restore completes', async () => {
    const olderRestore = createDeferred<AuthenticationResult>();
    const newerRestore = createDeferred<AuthenticationResult>();
    let restoreCount = 0;
    const controller = new AuthenticationController(createGateway({
      restore: () => {
        restoreCount += 1;
        return restoreCount === 1 ? olderRestore.promise : newerRestore.promise;
      },
    }));

    const olderResult = controller.restoreAuthentication();
    const newerResult = controller.restoreAuthentication();
    newerRestore.resolve({ status: 'authenticated', user: appUser });
    await newerResult;
    olderRestore.reject(new Error('stale provider failure'));

    await expect(olderResult).resolves.toEqual({
      status: 'authenticated',
      user: appUser,
    });
    expect(controller.state).toEqual({ status: 'authenticated', user: appUser });
  });

  it('starts initializing, remains initializing while restore is pending, then commits the final state', async () => {
    const pendingRestore = createDeferred<AuthenticationResult>();
    const controller = new AuthenticationController(createGateway({
      restore: () => pendingRestore.promise,
    }));

    expect(controller.state).toEqual({ status: 'initializing' });
    const restoration = controller.restoreAuthentication();
    expect(controller.state).toEqual({ status: 'initializing' });
    pendingRestore.resolve({ status: 'authenticated', user: appUser });

    await expect(restoration).resolves.toEqual({
      status: 'authenticated',
      user: appUser,
    });
    expect(controller.state).toEqual({ status: 'authenticated', user: appUser });
  });

  it.each<AuthenticationResult>([
    { status: 'unauthenticated' },
    { status: 'unauthorized' },
    { status: 'authenticated', user: appUser },
  ])('maps the $status result after redirect completion', async (result) => {
    const controller = new AuthenticationController(createGateway({
      restore: () => Promise.resolve(result),
    }));

    await expect(controller.completeAuthenticationRedirect()).resolves.toEqual(result);
  });

  it('keeps non-admin denial at the gateway result boundary', async () => {
    const controller = new AuthenticationController(createGateway({
      restore: () => Promise.resolve({ status: 'unauthorized' }),
    }));

    expect(isGarageAdmin(memberUser)).toBe(false);
    await expect(controller.restoreAuthentication()).resolves.toEqual({
      status: 'unauthorized',
    });
    expect(controller.getCurrentAppUser()).toBeNull();
  });

  it('can retry a provisioning error and reach an authenticated state', async () => {
    let restoreCount = 0;
    const controller = new AuthenticationController(createGateway({
      restore: () => {
        restoreCount += 1;
        return restoreCount === 1
          ? Promise.reject(createCategorizedFailure('provisioning_failed'))
          : Promise.resolve({ status: 'authenticated', user: appUser });
      },
    }));

    await expect(controller.completeAuthenticationRedirect()).resolves.toEqual({
      status: 'error',
      error: createAuthenticationError('provisioning_failed'),
    });
    await expect(controller.restoreAuthentication()).resolves.toEqual({
      status: 'authenticated',
      user: appUser,
    });
  });

  it('treats a revoked callback session as unauthenticated', async () => {
    const controller = new AuthenticationController(createGateway({
      restore: () => Promise.reject(createCategorizedFailure('session_expired')),
    }));

    await expect(controller.completeAuthenticationRedirect()).resolves.toEqual({
      status: 'unauthenticated',
    });
  });

  it.each([undefined, '/auth/callback'])(
    'uses the dashboard return path for an absent or unsafe value: %s',
    async (returnPath) => {
      let receivedReturnPath: string | undefined;
      const controller = new AuthenticationController(createGateway({
        signInWithGoogle: (path) => {
          receivedReturnPath = path;
          return Promise.resolve();
        },
      }));

      await controller.signInWithGoogle(returnPath);

      expect(receivedReturnPath).toBe(DEFAULT_RETURN_PATH);
    },
  );

  it('ignores a stale sign-in cancellation after sign-out succeeds', async () => {
    const pendingSignIn = createDeferred<undefined>();
    const controller = new AuthenticationController(createGateway({
      signInWithGoogle: () => pendingSignIn.promise,
    }));

    const signInResult = controller.signInWithGoogle('/dashboard');
    await controller.signOut();
    pendingSignIn.reject(createCategorizedFailure('sign_in_cancelled'));

    await expect(signInResult).resolves.toEqual({ status: 'unauthenticated' });
    expect(controller.state).toEqual({ status: 'unauthenticated' });
  });

  it('ignores a stale sign-out failure after a newer restore completes', async () => {
    const pendingSignOut = createDeferred<undefined>();
    let restoreCount = 0;
    const controller = new AuthenticationController(createGateway({
      restore: () => {
        restoreCount += 1;
        return Promise.resolve(restoreCount === 1
          ? { status: 'authenticated', user: appUser }
          : { status: 'unauthorized' });
      },
      signOut: () => pendingSignOut.promise,
    }));
    await controller.restoreAuthentication();

    const signOutResult = controller.signOut();
    expect(controller.getCurrentAppUser()).toBeNull();
    await controller.restoreAuthentication();
    pendingSignOut.reject(new Error('stale sign-out failure'));

    await expect(signOutResult).resolves.toEqual({ status: 'unauthorized' });
    expect(controller.state).toEqual({ status: 'unauthorized' });
  });

  it('notifies subscribers for initializing and committed state transitions', async () => {
    const controller = new AuthenticationController(createGateway({
      restore: () => Promise.resolve({ status: 'authenticated', user: appUser }),
    }));
    const observedStatuses: string[] = [];
    const unsubscribe = controller.subscribe(() => {
      observedStatuses.push(controller.state.status);
    });

    await controller.restoreAuthentication();

    expect(observedStatuses).toEqual(['initializing', 'authenticated']);

    unsubscribe();
    await controller.signOut();
    expect(observedStatuses).toEqual(['initializing', 'authenticated']);
  });
});
