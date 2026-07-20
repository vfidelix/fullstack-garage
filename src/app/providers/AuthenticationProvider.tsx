import {
  useCallback,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import type { AuthenticationController } from '../../application/use-cases/auth/authenticationController';
import type { AuthenticationSessionEvents } from '../../application/ports/authenticationSessionEvents';
import {
  getAuthenticationController,
  getAuthenticationSessionEvents,
} from '../authenticationComposition';
import {
  AuthenticationContext,
  type AuthenticationContextValue,
} from './authenticationContext';

interface AuthenticationProviderProps {
  readonly children: ReactNode;
  readonly controller?: AuthenticationController;
  readonly sessionEvents?: AuthenticationSessionEvents;
}

const startupRestores = new WeakSet<AuthenticationController>();

function restoreAtStartup(controller: AuthenticationController): void {
  if (!startupRestores.has(controller)) {
    startupRestores.add(controller);
    void controller.restoreAuthentication();
  }
}

export function AuthenticationProvider({
  children,
  controller: providedController,
  sessionEvents: providedSessionEvents,
}: AuthenticationProviderProps) {
  const controller = providedController ?? getAuthenticationController();
  const sessionEvents = providedSessionEvents ?? getAuthenticationSessionEvents();
  const subscribe = useCallback(
    (listener: () => void) => controller.subscribe(listener),
    [controller],
  );
  const getSnapshot = useCallback(() => controller.state, [controller]);
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const completeAuthenticationRedirect = useCallback(
    () => controller.completeAuthenticationRedirect(),
    [controller],
  );
  const registerPrivateStateCleanup = useCallback(
    (cleanup: Parameters<AuthenticationController['registerPrivateStateCleanup']>[0]) => (
      controller.registerPrivateStateCleanup(cleanup)
    ),
    [controller],
  );
  const restoreAuthentication = useCallback(
    () => controller.restoreAuthentication(),
    [controller],
  );
  const signInWithGoogle = useCallback(
    (returnPath?: string) => controller.signInWithGoogle(returnPath),
    [controller],
  );
  const signOut = useCallback(() => controller.signOut(), [controller]);

  useEffect(() => {
    restoreAtStartup(controller);

    return sessionEvents.subscribe(() => {
      void controller.restoreAuthentication();
    });
  }, [controller, sessionEvents]);

  const value = useMemo<AuthenticationContextValue>(() => ({
    completeAuthenticationRedirect,
    registerPrivateStateCleanup,
    restoreAuthentication,
    signInWithGoogle,
    signOut,
    state,
  }), [
    completeAuthenticationRedirect,
    registerPrivateStateCleanup,
    restoreAuthentication,
    signInWithGoogle,
    signOut,
    state,
  ]);

  return (
    <AuthenticationContext.Provider value={value}>
      {children}
    </AuthenticationContext.Provider>
  );
}
