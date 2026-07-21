import {
  CarFront,
  LoaderCircle,
  Plus,
  RotateCcw,
  TriangleAlert,
} from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
import {
  ARCHIVED_VEHICLES_PATH,
  createVehicleDetailPath,
  NEW_VEHICLE_PATH,
  VEHICLES_PATH,
} from '../../app/routes/routePaths';
import {
  formatVehicleLabel,
  type VehicleLifecycleState,
  type VehicleSummary,
} from '../../domain/vehicles/vehicle';
import {
  useActiveVehiclesQuery,
  useArchivedVehiclesQuery,
} from './vehicleQueries';
import styles from './VehicleListScreen.module.css';

interface VehicleListScreenProps {
  readonly lifecycle: VehicleLifecycleState;
}

const odometerFormatter = new Intl.NumberFormat('en-AU', {
  maximumFractionDigits: 0,
  useGrouping: true,
});

function formatOdometer(vehicle: VehicleSummary): string {
  return vehicle.currentOdometer === undefined
    ? 'Not recorded'
    : `${odometerFormatter.format(vehicle.currentOdometer)} ${vehicle.odometerUnit}`;
}

function VehicleRow({
  lifecycle,
  vehicle,
}: {
  readonly lifecycle: VehicleLifecycleState;
  readonly vehicle: VehicleSummary;
}) {
  const label = formatVehicleLabel(vehicle);
  const makeAndModel = `${vehicle.make} ${vehicle.model}`;

  return (
    <li className={styles.listItem}>
      <article
        aria-label={label}
        className={`${styles.vehicleRow ?? ''} ${
          lifecycle === 'active' ? (styles.vehicleRowActive ?? '') : ''
        }`}
      >
        <div className={styles.vehicleIdentity}>
          <span className={styles.fieldLabel}>Vehicle</span>
          <h3 className={styles.vehicleLabel}>
            <Link className={styles.vehicleLink ?? ''} to={createVehicleDetailPath(vehicle.id)}>
              {label}
            </Link>
          </h3>
          <span className={styles.makeModel}>{makeAndModel}</span>
        </div>
        <dl className={styles.details}>
          <div className={styles.detail}>
            <dt>Registration</dt>
            <dd>{vehicle.registration ?? 'Not recorded'}</dd>
          </div>
          <div className={styles.detail}>
            <dt>Year</dt>
            <dd>{vehicle.year ?? 'Not recorded'}</dd>
          </div>
          <div className={styles.detail}>
            <dt>Odometer</dt>
            <dd className={styles.numericValue}>{formatOdometer(vehicle)}</dd>
          </div>
          <div className={styles.detail}>
            <dt>State</dt>
            <dd>{lifecycle === 'active' ? 'Active' : 'Archived'}</dd>
          </div>
        </dl>
      </article>
    </li>
  );
}

function VehicleListStatus({
  lifecycle,
  onRetry,
  status,
}: {
  readonly lifecycle: VehicleLifecycleState;
  readonly onRetry: () => void;
  readonly status: 'empty' | 'error' | 'loading';
}) {
  const lifecycleLabel = lifecycle === 'active' ? 'active' : 'archived';
  const loadingCopy = `Loading ${lifecycleLabel} Vehicles…`;
  const emptyCopy = `No ${lifecycleLabel} Vehicles.`;

  if (status === 'loading') {
    return (
      <div
        aria-label={`Loading ${lifecycleLabel} Vehicles`}
        aria-live="polite"
        className={styles.statusPanel}
        role="status"
      >
        <LoaderCircle aria-hidden="true" className={styles.spinner} />
        <p>{loadingCopy}</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className={styles.statusPanel}>
        <TriangleAlert aria-hidden="true" className={styles.statusIcon} />
        <p role="alert">Vehicles are temporarily unavailable. Please try again.</p>
        <button className={styles.retryButton} onClick={onRetry} type="button">
          <RotateCcw aria-hidden="true" className={styles.buttonIcon} />
          <span>Try again</span>
        </button>
      </div>
    );
  }

  return (
    <div className={styles.statusPanel}>
      <CarFront aria-hidden="true" className={styles.statusIcon} />
      <p>{emptyCopy}</p>
    </div>
  );
}

type VehicleListQuery = ReturnType<typeof useActiveVehiclesQuery>;

function VehicleListContent({
  lifecycle,
  query,
}: VehicleListScreenProps & { readonly query: VehicleListQuery }) {
  const lifecycleTitle = lifecycle === 'active' ? 'Active' : 'Archived';
  const sectionTitle = `${lifecycleTitle} Vehicles`;
  const vehicles = query.data ?? [];

  return (
    <main className={styles.page} data-testid="protected-content">
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Garage inventory</p>
          <h1 className={styles.pageTitle}>Vehicles</h1>
        </div>
        <div className={styles.headerActions}>
          <p className={styles.summary} aria-live="polite">
            {query.isSuccess
              ? `${String(vehicles.length)} ${lifecycle.toLowerCase()} ${
                vehicles.length === 1 ? 'Vehicle' : 'Vehicles'
              }`
              : sectionTitle}
          </p>
          <Link className={styles.addLink ?? ''} to={NEW_VEHICLE_PATH}>
            <Plus aria-hidden="true" className={styles.buttonIcon} />
            <span>Add Vehicle</span>
          </Link>
        </div>
      </header>

      <nav aria-label="Vehicle views" className={styles.viewNavigation}>
        <NavLink
          className={({ isActive }) => (
            isActive
              ? `${styles.viewLink ?? ''} ${styles.viewLinkActive ?? ''}`
              : (styles.viewLink ?? '')
          )}
          end
          to={VEHICLES_PATH}
        >
          Active
        </NavLink>
        <NavLink
          className={({ isActive }) => (
            isActive
              ? `${styles.viewLink ?? ''} ${styles.viewLinkActive ?? ''}`
              : (styles.viewLink ?? '')
          )}
          to={ARCHIVED_VEHICLES_PATH}
        >
          Archived
        </NavLink>
      </nav>

      <section aria-labelledby="vehicle-list-title" className={styles.listSection}>
        <h2 className={styles.sectionTitle} id="vehicle-list-title">
          {sectionTitle}
        </h2>
        {query.isPending && (
          <VehicleListStatus
            lifecycle={lifecycle}
            onRetry={() => undefined}
            status="loading"
          />
        )}
        {query.isError && (
          <VehicleListStatus
            lifecycle={lifecycle}
            onRetry={() => {
              void query.refetch();
            }}
            status="error"
          />
        )}
        {query.isSuccess && vehicles.length === 0 && (
          <VehicleListStatus
            lifecycle={lifecycle}
            onRetry={() => undefined}
            status="empty"
          />
        )}
        {query.isSuccess && vehicles.length > 0 && (
          <ul aria-label={`${lifecycleTitle} Vehicles`} className={styles.vehicleList}>
            {vehicles.map((vehicle) => (
              <VehicleRow
                key={vehicle.id}
                lifecycle={lifecycle}
                vehicle={vehicle}
              />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function ActiveVehicleListScreen() {
  const query = useActiveVehiclesQuery();
  return <VehicleListContent lifecycle="active" query={query} />;
}

function ArchivedVehicleListScreen() {
  const query = useArchivedVehiclesQuery();
  return <VehicleListContent lifecycle="archived" query={query} />;
}

export function VehicleListScreen({ lifecycle }: VehicleListScreenProps) {
  return lifecycle === 'active'
    ? <ActiveVehicleListScreen />
    : <ArchivedVehicleListScreen />;
}
