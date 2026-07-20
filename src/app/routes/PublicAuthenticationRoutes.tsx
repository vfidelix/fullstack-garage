import {
  Navigate,
  useLocation,
} from 'react-router-dom';
import { isGarageAdmin } from '../../domain/users/appUser';
import { resolveSafeReturnPath } from '../../shared/validation/safeReturnPath';
import {
  AccessUnavailableScreen,
  AuthenticationErrorScreen,
  AuthenticationLoadingScreen,
  SignInScreen,
} from '../../features/auth/AuthenticationScreens';
import { useAuthentication } from '../providers/authenticationContext';
import {
  ACCESS_UNAVAILABLE_PATH,
  createSignInPath,
  DASHBOARD_PATH,
} from './routePaths';

function useReturnPath(): string {
  const location = useLocation();
  const returnPath = new URLSearchParams(location.search).get('returnPath');

  return resolveSafeReturnPath(returnPath);
}

export function SignInRoute() {
  const authentication = useAuthentication();
  const returnPath = useReturnPath();

  switch (authentication.state.status) {
    case 'initializing':
      return <AuthenticationLoadingScreen />;
    case 'authenticated':
      return <Navigate replace to={returnPath} />;
    case 'unauthorized':
      return <Navigate replace to={ACCESS_UNAVAILABLE_PATH} />;
    case 'error':
      return (
        <AuthenticationErrorScreen
          category={authentication.state.error.category}
          onRetry={() => {
            void authentication.signInWithGoogle(returnPath);
          }}
        />
      );
    case 'unauthenticated':
      return (
        <SignInScreen
          onSignIn={() => {
            void authentication.signInWithGoogle(returnPath);
          }}
        />
      );
  }
}

export function AccessUnavailableRoute() {
  const authentication = useAuthentication();

  switch (authentication.state.status) {
    case 'initializing':
      return <AuthenticationLoadingScreen />;
    case 'authenticated':
      return isGarageAdmin(authentication.state.user)
        ? <Navigate replace to={DASHBOARD_PATH} />
        : (
            <AccessUnavailableScreen
              onSignOut={() => {
                void authentication.signOut();
              }}
            />
          );
    case 'unauthenticated':
      return <Navigate replace to={createSignInPath(DASHBOARD_PATH)} />;
    case 'error':
      return (
        <AuthenticationErrorScreen
          category={authentication.state.error.category}
          onRetry={() => {
            void authentication.restoreAuthentication();
          }}
        />
      );
    case 'unauthorized':
      return (
        <AccessUnavailableScreen
          onSignOut={() => {
            void authentication.signOut();
          }}
        />
      );
  }
}

export function AuthenticationCallbackRoute() {
  const authentication = useAuthentication();
  const returnPath = useReturnPath();

  switch (authentication.state.status) {
    case 'initializing':
      return <AuthenticationLoadingScreen />;
    case 'authenticated':
      return <Navigate replace to={returnPath} />;
    case 'unauthorized':
      return <Navigate replace to={ACCESS_UNAVAILABLE_PATH} />;
    case 'unauthenticated':
      return <Navigate replace to={createSignInPath(returnPath)} />;
    case 'error':
      return (
        <AuthenticationErrorScreen
          category={authentication.state.error.category}
          onRetry={() => {
            void authentication.completeAuthenticationRedirect();
          }}
        />
      );
  }
}
