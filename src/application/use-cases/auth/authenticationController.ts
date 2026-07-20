import {
  createAuthenticationError,
  type AuthenticationError,
  type AuthenticationErrorCategory,
} from '../../authentication/authenticationError';
import type {
  AuthenticationResult,
  AuthenticationState,
} from '../../authentication/authenticationModels';
import {
  PrivateStateCleanupRegistry,
  type PrivateStateCleanup,
  type UnregisterPrivateStateCleanup,
} from '../../authentication/privateStateCleanupRegistry';
import type { AuthGateway } from '../../ports/authGateway';
import type { AppUser, AppUserId } from '../../../domain/users/appUser';
import { resolveSafeReturnPath } from '../../../shared/validation/safeReturnPath';

export type AuthenticationStateListener = () => void;

function getErrorCategory(error: unknown): AuthenticationErrorCategory | null {
  if (typeof error !== 'object' || error === null || !('category' in error)) {
    return null;
  }

  switch (error.category) {
    case 'sign_in_cancelled':
    case 'sign_in_unavailable':
    case 'invalid_callback':
    case 'session_expired':
    case 'provisioning_failed':
    case 'sign_out_failed':
    case 'unexpected':
      return error.category;
    default:
      return null;
  }
}

function mapError(
  error: unknown,
  fallbackCategory: AuthenticationErrorCategory,
): AuthenticationError {
  return createAuthenticationError(getErrorCategory(error) ?? fallbackCategory);
}

export class AuthenticationController {
  private currentState: AuthenticationState = { status: 'initializing' };
  private readonly listeners = new Set<AuthenticationStateListener>();
  private operationGeneration = 0;
  private privateStateCleanupBarrier: Promise<void> = Promise.resolve();
  private privateStateOwnerId: AppUserId | null = null;

  public constructor(
    private readonly gateway: AuthGateway,
    private readonly privateStateCleanupRegistry = new PrivateStateCleanupRegistry(),
  ) {}

  public get state(): AuthenticationState {
    return this.currentState;
  }

  public subscribe(listener: AuthenticationStateListener): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  public registerPrivateStateCleanup(
    cleanup: PrivateStateCleanup,
  ): UnregisterPrivateStateCleanup {
    return this.privateStateCleanupRegistry.register(cleanup);
  }

  public async restoreAuthentication(): Promise<AuthenticationState> {
    return this.restore('unexpected');
  }

  public async signInWithGoogle(returnPath?: string): Promise<AuthenticationState> {
    const operation = this.beginOperation();

    try {
      await this.gateway.signInWithGoogle(resolveSafeReturnPath(returnPath));
    } catch (error: unknown) {
      if (this.isCurrentOperation(operation)) {
        await this.commitState(operation, {
          status: 'error',
          error: mapError(error, 'sign_in_unavailable'),
        });
      }
    }

    return this.currentState;
  }

  public async completeAuthenticationRedirect(): Promise<AuthenticationState> {
    return this.restore('invalid_callback');
  }

  public getCurrentAppUser(): AppUser | null {
    return this.currentState.status === 'authenticated'
      ? this.currentState.user
      : null;
  }

  public async signOut(): Promise<AuthenticationState> {
    const operation = this.beginOperation();
    const cleanup = this.releasePrivateStateOwner();
    let gatewaySignOut: Promise<boolean>;

    try {
      gatewaySignOut = Promise.resolve(this.gateway.signOut()).then(
        () => true,
        () => false,
      );
    } catch {
      gatewaySignOut = Promise.resolve(false);
    }

    const [signOutSucceeded] = await Promise.all([gatewaySignOut, cleanup]);

    if (this.isCurrentOperation(operation)) {
      if (signOutSucceeded) {
        await this.commitState(operation, { status: 'unauthenticated' });
      } else {
        await this.commitState(operation, {
          status: 'error',
          error: createAuthenticationError('sign_out_failed'),
        });
      }
    }

    return this.currentState;
  }

  private async restore(
    fallbackCategory: AuthenticationErrorCategory,
  ): Promise<AuthenticationState> {
    const operation = this.beginOperation();

    try {
      const result: AuthenticationResult = await this.gateway.restore();
      if (this.isCurrentOperation(operation)) {
        await this.commitState(operation, result);
      }
    } catch (error: unknown) {
      if (this.isCurrentOperation(operation)) {
        const category = getErrorCategory(error);

        await this.commitState(operation, category === 'session_expired'
          ? { status: 'unauthenticated' }
          : {
              status: 'error',
              error: mapError(error, fallbackCategory),
            });
      }
    }

    return this.currentState;
  }

  private beginOperation(): number {
    this.operationGeneration += 1;
    const operation = this.operationGeneration;
    this.setState({ status: 'initializing' });
    return operation;
  }

  private async commitState(
    operation: number,
    state: AuthenticationState,
  ): Promise<void> {
    if (!this.isCurrentOperation(operation)) {
      return;
    }

    const nextOwnerId = state.status === 'authenticated' ? state.user.id : null;

    if (
      this.privateStateOwnerId !== null
      && this.privateStateOwnerId !== nextOwnerId
    ) {
      void this.releasePrivateStateOwner();
    }

    await this.privateStateCleanupBarrier;

    if (!this.isCurrentOperation(operation)) {
      return;
    }

    this.privateStateOwnerId = nextOwnerId;
    this.setState(state);
  }

  private releasePrivateStateOwner(): Promise<void> {
    if (this.privateStateOwnerId !== null) {
      this.privateStateOwnerId = null;
      this.privateStateCleanupBarrier = this.privateStateCleanupRegistry.clear();
    }

    return this.privateStateCleanupBarrier;
  }

  private setState(state: AuthenticationState): void {
    this.currentState = state;

    for (const listener of this.listeners) {
      listener();
    }
  }

  private isCurrentOperation(operation: number): boolean {
    return operation === this.operationGeneration;
  }
}
