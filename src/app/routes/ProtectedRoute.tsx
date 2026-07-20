import { Navigate, Outlet, useLocation } from 'react-router-dom';
import {
  AuthenticationErrorScreen,
  AuthenticationLoadingScreen,
} from '../../features/auth/AuthenticationScreens';
import { isGarageAdmin } from '../../domain/users/appUser';
import { AuthenticatedAppShell } from '../shell/AuthenticatedAppShell';
import { useAuthentication } from '../providers/authenticationContext';
import { ACCESS_UNAVAILABLE_PATH, createSignInPath } from './routePaths';

export function ProtectedRoute() {
  const authentication = useAuthentication();
  const location = useLocation();

  switch (authentication.state.status) {
    case 'initializing':
      return <AuthenticationLoadingScreen />;
    case 'unauthenticated':
      return (
        <Navigate
          replace
          to={createSignInPath(
            `${location.pathname}${location.search}${location.hash}`,
          )}
        />
      );
    case 'unauthorized':
      return <Navigate replace to={ACCESS_UNAVAILABLE_PATH} />;
    case 'error':
      return (
        <AuthenticationErrorScreen
          category={authentication.state.error.category}
          onRetry={() => {
            void authentication.restoreAuthentication();
          }}
        />
      );
    case 'authenticated':
      if (!isGarageAdmin(authentication.state.user)) {
        return <Navigate replace to={ACCESS_UNAVAILABLE_PATH} />;
      }

      return (
        <AuthenticatedAppShell
          onSignOut={() => {
            void authentication.signOut();
          }}
          user={authentication.state.user}
        >
          <Outlet />
        </AuthenticatedAppShell>
      );
  }
}
