import { createContext, useContext, useEffect } from 'react';
import type { AuthenticationState } from '../../application/authentication/authenticationModels';
import type { PrivateStateCleanup } from '../../application/authentication/privateStateCleanupRegistry';

export interface AuthenticationContextValue {
  readonly completeAuthenticationRedirect: () => Promise<AuthenticationState>;
  readonly registerPrivateStateCleanup: (
    cleanup: PrivateStateCleanup,
  ) => () => void;
  readonly restoreAuthentication: () => Promise<AuthenticationState>;
  readonly signInWithGoogle: (returnPath?: string) => Promise<AuthenticationState>;
  readonly signOut: () => Promise<AuthenticationState>;
  readonly state: AuthenticationState;
}

export function usePrivateStateCleanup(cleanup: PrivateStateCleanup): void {
  const { registerPrivateStateCleanup } = useAuthentication();

  useEffect(
    () => registerPrivateStateCleanup(cleanup),
    [cleanup, registerPrivateStateCleanup],
  );
}

export const AuthenticationContext = createContext<
  AuthenticationContextValue | undefined
>(undefined);

export function useAuthentication(): AuthenticationContextValue {
  const authentication = useContext(AuthenticationContext);

  if (authentication === undefined) {
    throw new Error('useAuthentication must be used within AuthenticationProvider.');
  }

  return authentication;
}
