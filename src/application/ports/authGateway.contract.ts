import { describe, expect, it } from 'vitest';
import {
  createAuthenticationError,
  type AuthenticationErrorCategory,
} from '../authentication/authenticationError';
import type { AppUser } from '../../domain/users/appUser';
import type { AuthGateway } from './authGateway';

export type AuthGatewayRestoreScenario
  = | 'unauthenticated'
    | 'unauthorized'
    | 'authenticated_admin'
    | 'member';

export type AuthGatewayFailureOperation
  = | 'restore'
    | 'profile'
    | 'sign_in'
    | 'callback'
    | 'sign_out';

export interface AuthGatewayContractScenario {
  readonly failure?: {
    readonly category: AuthenticationErrorCategory;
    readonly operation: AuthGatewayFailureOperation;
    readonly privateMarker: string;
  };
  readonly restore?: AuthGatewayRestoreScenario;
  readonly restoreContext?: 'ordinary' | 'callback';
}

export interface AuthGatewayContractHarness {
  readonly expectedAdmin: AppUser;
  readonly gateway: AuthGateway;
  readForwardedReturnPath(): string | null;
}

export type CreateAuthGatewayContractHarness = (
  scenario?: AuthGatewayContractScenario,
) => AuthGatewayContractHarness;

async function captureFailure(operation: () => Promise<unknown>): Promise<unknown> {
  try {
    await operation();
  } catch (error: unknown) {
    return error;
  }

  throw new Error('Expected authentication gateway operation to fail.');
}

function assertSafeFailure(
  error: unknown,
  category: AuthenticationErrorCategory,
  privateMarker: string,
): void {
  expect(error).toMatchObject(createAuthenticationError(category));
  expect(JSON.stringify(error)).not.toContain(privateMarker);

  if (typeof error !== 'object' || error === null) {
    throw new Error('Expected the gateway to throw an object error.');
  }

  for (const rawField of ['cause', 'code', 'details', 'payload', 'query', 'token']) {
    expect(Object.hasOwn(error, rawField)).toBe(false);
  }

  if (error instanceof Error) {
    expect(error.name).not.toContain(privateMarker);
    expect(error.stack ?? '').not.toContain(privateMarker);
  }
}

function runFailureOperation(
  harness: AuthGatewayContractHarness,
  operation: AuthGatewayFailureOperation,
): Promise<unknown> {
  switch (operation) {
    case 'sign_in':
      return harness.gateway.signInWithGoogle('/vehicles');
    case 'sign_out':
      return harness.gateway.signOut();
    case 'restore':
    case 'profile':
    case 'callback':
      return harness.gateway.restore();
  }
}

export function describeAuthGatewayContract(
  adapterName: string,
  createHarness: CreateAuthGatewayContractHarness,
): void {
  describe(`${adapterName} AuthGateway contract`, () => {
    it.each([
      ['unauthenticated', { status: 'unauthenticated' }],
      ['unauthorized', { status: 'unauthorized' }],
      ['member', { status: 'unauthorized' }],
    ] as const)('restores %s as an app-owned result', async (restore, expected) => {
      const { gateway } = createHarness({ restore });

      await expect(gateway.restore()).resolves.toEqual(expected);
    });

    it('restores the authorized Garage Admin as an app-owned user', async () => {
      const { expectedAdmin, gateway } = createHarness({
        restore: 'authenticated_admin',
      });

      await expect(gateway.restore()).resolves.toEqual({
        status: 'authenticated',
        user: expectedAdmin,
      });
    });

    it('restores the authorized Garage Admin after a successful callback', async () => {
      const { expectedAdmin, gateway } = createHarness({
        restore: 'authenticated_admin',
        restoreContext: 'callback',
      });

      await expect(gateway.restore()).resolves.toEqual({
        status: 'authenticated',
        user: expectedAdmin,
      });
    });

    it('preserves a safe local deep link for sign-in', async () => {
      const harness = createHarness();
      const returnPath = '/vehicles/garage-queen?tab=history#latest';

      await harness.gateway.signInWithGoogle(returnPath);

      expect(harness.readForwardedReturnPath()).toBe(returnPath);
    });

    it.each([
      'https://attacker.example/private',
      '//attacker.example/private',
      '/auth/callback?returnPath=/vehicles',
    ])('falls back safely from the sign-in path %s', async (returnPath) => {
      const harness = createHarness();

      await harness.gateway.signInWithGoogle(returnPath);

      expect(harness.readForwardedReturnPath()).toBe('/dashboard');
    });

    it.each([
      ['sign_in', 'sign_in_cancelled'],
      ['sign_in', 'sign_in_unavailable'],
      ['restore', 'session_expired'],
      ['restore', 'unexpected'],
      ['profile', 'provisioning_failed'],
      ['callback', 'invalid_callback'],
      ['callback', 'sign_in_cancelled'],
      ['callback', 'session_expired'],
      ['sign_out', 'sign_out_failed'],
    ] as const)('maps %s failure to safe %s', async (operation, category) => {
      const privateMarker = `private-${operation}-${category}`;
      const harness = createHarness({
        failure: { category, operation, privateMarker },
      });
      const action = () => runFailureOperation(harness, operation);

      const error = await captureFailure(action);

      assertSafeFailure(error, category, privateMarker);
    });

    it('signs out successfully', async () => {
      const { gateway } = createHarness();

      await expect(gateway.signOut()).resolves.toBeUndefined();
    });
  });
}
