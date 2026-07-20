import { Route, Routes, useLocation } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import {
  AccessUnavailableRoute,
  AuthenticationCallbackRoute,
  SignInRoute,
} from './PublicAuthenticationRoutes';
import {
  ACCESS_UNAVAILABLE_PATH,
  AUTH_CALLBACK_PATH,
  DASHBOARD_PATH,
  SIGN_IN_PATH,
} from './routePaths';

function DashboardRoute() {
  return (
    <main data-testid="protected-content">
      <h1>Dashboard</h1>
    </main>
  );
}

function ProtectedApplicationRoute() {
  const location = useLocation();
  const currentPath = `${location.pathname}${location.search}${location.hash}`;

  return (
    <main data-testid="protected-content">
      <h1>Fullstack Garage</h1>
      <output aria-label="Current application path">
        {currentPath}
      </output>
    </main>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path={SIGN_IN_PATH} element={<SignInRoute />} />
      <Route path={AUTH_CALLBACK_PATH} element={<AuthenticationCallbackRoute />} />
      <Route path={ACCESS_UNAVAILABLE_PATH} element={<AccessUnavailableRoute />} />
      <Route element={<ProtectedRoute />}>
        <Route path={DASHBOARD_PATH} element={<DashboardRoute />} />
        <Route path="/*" element={<ProtectedApplicationRoute />} />
      </Route>
    </Routes>
  );
}
