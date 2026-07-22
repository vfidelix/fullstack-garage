import { Route, Routes, useLocation } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import {
  AccessUnavailableRoute,
  AuthenticationCallbackRoute,
  SignInRoute,
} from './PublicAuthenticationRoutes';
import {
  ACCESS_UNAVAILABLE_PATH,
  ARCHIVED_VEHICLES_PATH,
  AUTH_CALLBACK_PATH,
  DASHBOARD_PATH,
  NEW_VEHICLE_PATH,
  REGISTRATION_LOOKUP_PRIVACY_PATH,
  SIGN_IN_PATH,
  VEHICLE_DETAIL_PATH,
  VEHICLE_EDIT_PATH,
  VEHICLES_PATH,
} from './routePaths';
import { VehicleDetailScreen } from '../../features/vehicles/VehicleDetailScreen';
import { VehicleFormScreen } from '../../features/vehicles/VehicleFormScreen';
import { VehicleListScreen } from '../../features/vehicles/VehicleListScreen';

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

function RegistrationLookupPrivacyRoute() {
  return (
    <main>
      <h1>Registration lookup privacy notice</h1>
      <p>When you choose to use registration lookup, your Registration and selected Australian state or territory are sent to PlateAPI to return a Vehicle suggestion.</p>
      <p>Lookup is optional. You can create a Vehicle manually without sending this information to PlateAPI.</p>
      <p>
        <a href="https://plateapi.com.au/privacy/" rel="noreferrer" target="_blank">
          Read the PlateAPI privacy policy
        </a>
        .
      </p>
    </main>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path={SIGN_IN_PATH} element={<SignInRoute />} />
      <Route path={AUTH_CALLBACK_PATH} element={<AuthenticationCallbackRoute />} />
      <Route path={ACCESS_UNAVAILABLE_PATH} element={<AccessUnavailableRoute />} />
      <Route path={REGISTRATION_LOOKUP_PRIVACY_PATH} element={<RegistrationLookupPrivacyRoute />} />
      <Route element={<ProtectedRoute />}>
        <Route path={DASHBOARD_PATH} element={<DashboardRoute />} />
        <Route
          path={VEHICLES_PATH}
          element={<VehicleListScreen lifecycle="active" />}
        />
        <Route
          path={ARCHIVED_VEHICLES_PATH}
          element={<VehicleListScreen lifecycle="archived" />}
        />
        <Route
          path={NEW_VEHICLE_PATH}
          element={<VehicleFormScreen mode="create" />}
        />
        <Route
          path={VEHICLE_EDIT_PATH}
          element={<VehicleFormScreen mode="edit" />}
        />
        <Route
          path={VEHICLE_DETAIL_PATH}
          element={<VehicleDetailScreen />}
        />
        <Route path="/*" element={<ProtectedApplicationRoute />} />
      </Route>
    </Routes>
  );
}
