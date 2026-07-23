import { describe, expect, it, vi } from 'vitest';
import {
  createAuthenticationError,
  type AuthenticationErrorCategory,
} from '../../authentication/authenticationError';
import type { AuthenticationResult } from '../../authentication/authenticationModels';
import { PrivateStateCleanupRegistry } from '../../authentication/privateStateCleanupRegistry';
import type { AuthGateway } from '../../ports/authGateway';
import type { AppUser } from '../../../domain/users/appUser';
import { AuthenticationController } from './authenticationController';

const userA: AppUser = {
  id: '2dc6ce1b-03a9-4c79-a658-0459528a4d4c',
  displayName: 'Garage Operator A',
  role: 'admin',
  createdAt: '2026-07-20T00:00:00.000Z',
  updatedAt: '2026-07-20T00:00:00.000Z',
};

const userB: AppUser = {
  ...userA,
  id: '7fa46ce4-a131-4e39-b8f0-66a702151b85',
  displayName: 'Garage Operator B',
};

function createGateway(overrides: Partial<AuthGateway> = {}): AuthGateway {
  return {
    restore: vi.fn().mockResolvedValue({ status: 'unauthenticated' }),
    signInWithGoogle: vi.fn().mockResolvedValue(undefined),
    signOut: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function createDeferred<T>(): {
  readonly promise: Promise<T>;
  readonly reject: (reason?: unknown) => void;
  readonly resolve: (value: T) => void;
} {
  let settlement: {
    readonly reject: (reason?: unknown) => void;
    readonly resolve: (value: T) => void;
  } | undefined;
  const promise = new Promise<T>((resolve, reject) => {
    settlement = { reject, resolve };
  });

  if (settlement === undefined) {
    throw new Error('Deferred promise was not initialized.');
  }

  return { promise, ...settlement };
}

function createCategorizedFailure(
  category: AuthenticationErrorCategory,
): Error & { readonly category: AuthenticationErrorCategory } {
  return Object.assign(new Error('provider details'), { category });
}

describe('AuthenticationController private-state cleanup', () => {
  it('does not clear private state for a same-user restoration', async () => {
    const cleanup = vi.fn();
    const restore = vi.fn().mockResolvedValue({
      status: 'authenticated',
      user: userA,
    });
    const controller = new AuthenticationController(createGateway({ restore }));
    controller.registerPrivateStateCleanup(cleanup);

    await controller.restoreAuthentication();
    await controller.restoreAuthentication();

    expect(cleanup).not.toHaveBeenCalled();
    expect(controller.state).toEqual({ status: 'authenticated', user: userA });
  });

  it('clears private state before assigning a different app user', async () => {
    const cleanupFinished = createDeferred<undefined>();
    const cleanup = vi.fn(() => cleanupFinished.promise);
    const restore = vi.fn()
      .mockResolvedValueOnce({ status: 'authenticated', user: userA })
      .mockResolvedValueOnce({ status: 'authenticated', user: userB });
    const controller = new AuthenticationController(createGateway({ restore }));
    controller.registerPrivateStateCleanup(cleanup);
    await controller.restoreAuthentication();

    const identityChange = controller.restoreAuthentication();
    await vi.waitFor(() => {
      expect(cleanup).toHaveBeenCalledOnce();
    });
    expect(controller.state).toEqual({ status: 'initializing' });

    cleanupFinished.resolve(undefined);
    await expect(identityChange).resolves.toEqual({
      status: 'authenticated',
      user: userB,
    });
  });

  it.each<AuthenticationResult>([
    { status: 'unauthenticated' },
    { status: 'unauthorized' },
  ])('clears user-owned state when access becomes $status', async (result) => {
    const cleanup = vi.fn();
    const restore = vi.fn()
      .mockResolvedValueOnce({ status: 'authenticated', user: userA })
      .mockResolvedValueOnce(result);
    const controller = new AuthenticationController(createGateway({ restore }));
    controller.registerPrivateStateCleanup(cleanup);
    await controller.restoreAuthentication();

    await expect(controller.restoreAuthentication()).resolves.toEqual(result);

    expect(cleanup).toHaveBeenCalledOnce();
  });

  it('clears user-owned state when background reconciliation finds an expired or revoked session', async () => {
    const cleanup = vi.fn();
    const restore = vi.fn()
      .mockResolvedValueOnce({ status: 'authenticated', user: userA })
      .mockRejectedValueOnce(createCategorizedFailure('session_expired'));
    const controller = new AuthenticationController(createGateway({ restore }));
    controller.registerPrivateStateCleanup(cleanup);
    await controller.restoreAuthentication();

    await expect(controller.reconcileAuthentication()).resolves.toEqual({
      status: 'unauthenticated',
    });

    expect(cleanup).toHaveBeenCalledOnce();
    expect(controller.getCurrentAppUser()).toBeNull();
  });

  it.each<AuthenticationResult>([
    { status: 'unauthenticated' },
    { status: 'unauthorized' },
  ])('removes protected access before asynchronous cleanup when background reconciliation becomes $status', async (result) => {
    const cleanupFinished = createDeferred<undefined>();
    const cleanup = vi.fn(() => cleanupFinished.promise);
    const restore = vi.fn()
      .mockResolvedValueOnce({ status: 'authenticated', user: userA })
      .mockResolvedValueOnce(result);
    const controller = new AuthenticationController(createGateway({ restore }));
    controller.registerPrivateStateCleanup(cleanup);
    await controller.restoreAuthentication();

    const reconciliation = controller.reconcileAuthentication();
    await vi.waitFor(() => {
      expect(cleanup).toHaveBeenCalledOnce();
    });

    expect(controller.state).toEqual(result);
    expect(controller.getCurrentAppUser()).toBeNull();

    cleanupFinished.resolve(undefined);
    await expect(reconciliation).resolves.toEqual(result);
  });

  it('removes protected access before asynchronous cleanup when background reconciliation errors', async () => {
    const cleanupFinished = createDeferred<undefined>();
    const cleanup = vi.fn(() => cleanupFinished.promise);
    const restore = vi.fn()
      .mockResolvedValueOnce({ status: 'authenticated', user: userA })
      .mockRejectedValueOnce(new Error('provider details'));
    const controller = new AuthenticationController(createGateway({ restore }));
    controller.registerPrivateStateCleanup(cleanup);
    await controller.restoreAuthentication();

    const reconciliation = controller.reconcileAuthentication();
    await vi.waitFor(() => {
      expect(cleanup).toHaveBeenCalledOnce();
    });

    expect(controller.state).toEqual({
      status: 'error',
      error: createAuthenticationError('unexpected'),
    });
    expect(controller.getCurrentAppUser()).toBeNull();

    cleanupFinished.resolve(undefined);
    await expect(reconciliation).resolves.toEqual({
      status: 'error',
      error: createAuthenticationError('unexpected'),
    });
  });

  it('unmounts the old owner before asynchronous cleanup during background identity change', async () => {
    const cleanupFinished = createDeferred<undefined>();
    const cleanup = vi.fn(() => cleanupFinished.promise);
    const restore = vi.fn()
      .mockResolvedValueOnce({ status: 'authenticated', user: userA })
      .mockResolvedValueOnce({ status: 'authenticated', user: userB });
    const controller = new AuthenticationController(createGateway({ restore }));
    controller.registerPrivateStateCleanup(cleanup);
    await controller.restoreAuthentication();

    const reconciliation = controller.reconcileAuthentication();
    await vi.waitFor(() => {
      expect(cleanup).toHaveBeenCalledOnce();
    });

    expect(controller.state).toEqual({ status: 'initializing' });
    expect(controller.getCurrentAppUser()).toBeNull();

    cleanupFinished.resolve(undefined);
    await expect(reconciliation).resolves.toEqual({
      status: 'authenticated',
      user: userB,
    });
  });

  it('fails closed and clears private state immediately when a semantic access-lost event supersedes restoration', async () => {
    const pendingRestore = createDeferred<AuthenticationResult>();
    const cleanup = vi.fn();
    const restore = vi.fn()
      .mockResolvedValueOnce({ status: 'authenticated', user: userA })
      .mockImplementationOnce(() => pendingRestore.promise);
    const controller = new AuthenticationController(createGateway({ restore }));
    controller.registerPrivateStateCleanup(cleanup);
    await controller.restoreAuthentication();

    const reconciliation = controller.reconcileAuthentication();
    await expect(controller.handleAccessLost()).resolves.toEqual({
      status: 'unauthenticated',
    });

    expect(cleanup).toHaveBeenCalledOnce();
    expect(controller.getCurrentAppUser()).toBeNull();
    pendingRestore.resolve({ status: 'authenticated', user: userA });
    await expect(reconciliation).resolves.toEqual({ status: 'unauthenticated' });
    expect(controller.state).toEqual({ status: 'unauthenticated' });
  });

  it('clears user-owned state when restoration ends in an error', async () => {
    const cleanup = vi.fn();
    const restore = vi.fn()
      .mockResolvedValueOnce({ status: 'authenticated', user: userA })
      .mockRejectedValueOnce(new Error('provider details'));
    const controller = new AuthenticationController(createGateway({ restore }));
    controller.registerPrivateStateCleanup(cleanup);
    await controller.restoreAuthentication();

    await expect(controller.restoreAuthentication()).resolves.toEqual({
      status: 'error',
      error: createAuthenticationError('unexpected'),
    });

    expect(cleanup).toHaveBeenCalledOnce();
  });

  it('hides auth state synchronously and runs every cleanup during sign-out', async () => {
    const asyncCleanup = createDeferred<undefined>();
    const completedCleanup = vi.fn(() => asyncCleanup.promise);
    const signOut = vi.fn().mockResolvedValue(undefined);
    const registry = new PrivateStateCleanupRegistry();
    registry.register(() => {
      throw new Error('private cleanup details');
    });
    registry.register(completedCleanup);
    const controller = new AuthenticationController(
      createGateway({
        restore: vi.fn().mockResolvedValue({
          status: 'authenticated',
          user: userA,
        }),
        signOut,
      }),
      registry,
    );
    await controller.restoreAuthentication();

    const signOutResult = controller.signOut();

    expect(controller.state).toEqual({ status: 'initializing' });
    await vi.waitFor(() => {
      expect(completedCleanup).toHaveBeenCalledOnce();
      expect(signOut).toHaveBeenCalledOnce();
    });

    asyncCleanup.resolve(undefined);
    await expect(signOutResult).resolves.toEqual({ status: 'unauthenticated' });
  });

  it('clears private state even when gateway sign-out fails', async () => {
    const cleanup = vi.fn();
    const controller = new AuthenticationController(createGateway({
      restore: vi.fn().mockResolvedValue({
        status: 'authenticated',
        user: userA,
      }),
      signOut: vi.fn().mockRejectedValue(new Error('provider details')),
    }));
    controller.registerPrivateStateCleanup(cleanup);
    await controller.restoreAuthentication();

    await expect(controller.signOut()).resolves.toEqual({
      status: 'error',
      error: createAuthenticationError('sign_out_failed'),
    });

    expect(cleanup).toHaveBeenCalledOnce();
  });

  it('keeps cleanup ownership correct across stale identity races', async () => {
    const firstCleanup = createDeferred<undefined>();
    const cleanup = vi.fn()
      .mockImplementationOnce(() => firstCleanup.promise)
      .mockResolvedValue(undefined);
    const restore = vi.fn()
      .mockResolvedValueOnce({ status: 'authenticated', user: userA })
      .mockResolvedValueOnce({ status: 'authenticated', user: userB })
      .mockResolvedValueOnce({ status: 'authenticated', user: userA })
      .mockResolvedValueOnce({ status: 'authenticated', user: userB });
    const controller = new AuthenticationController(createGateway({ restore }));
    controller.registerPrivateStateCleanup(cleanup);
    await controller.restoreAuthentication();

    const staleChangeToB = controller.restoreAuthentication();
    await vi.waitFor(() => {
      expect(cleanup).toHaveBeenCalledOnce();
    });
    const recoveryToA = controller.restoreAuthentication();
    firstCleanup.resolve(undefined);

    await expect(recoveryToA).resolves.toEqual({
      status: 'authenticated',
      user: userA,
    });
    await expect(staleChangeToB).resolves.toEqual({
      status: 'authenticated',
      user: userA,
    });

    await controller.restoreAuthentication();
    expect(cleanup).toHaveBeenCalledTimes(2);
    expect(controller.state).toEqual({ status: 'authenticated', user: userB });
  });
});
