import {
  ArrowLeft,
  LoaderCircle,
  RotateCcw,
  TriangleAlert,
} from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  createVehicleDetailPath,
  VEHICLES_PATH,
} from '../../app/routes/routePaths';
import { getVehicleRegistrationLookup } from '../../app/vehicleComposition';
import type { CreateVehicle, VehicleId } from '../../domain/vehicles/vehicle';
import { VehicleForm } from './VehicleForm';
import { getSafeVehicleErrorMessage } from './vehicleErrorMessages';
import { useVehicleSessionGuard } from './vehicleContext';
import {
  useCreateVehicleMutation,
  useUpdateVehicleMutation,
  useVehicleQuery,
} from './vehicleQueries';
import styles from './VehicleWorkflowScreen.module.css';

interface VehicleFormScreenProps {
  readonly mode: 'create' | 'edit';
}

function navigateToSavedVehicle(
  navigate: ReturnType<typeof useNavigate>,
  vehicleId: VehicleId,
): void {
  void navigate(createVehicleDetailPath(vehicleId), { replace: true });
}

function CreateVehicleFormScreen() {
  const navigate = useNavigate();
  const mutation = useCreateVehicleMutation();
  const session = useVehicleSessionGuard();

  const saveVehicle = async (input: CreateVehicle): Promise<void> => {
    const generation = session.capture();

    try {
      const outcome = await mutation.mutateAsync(input);

      if (session.isCurrent(generation)) {
        navigateToSavedVehicle(
          navigate,
          outcome.vehicle.id,
        );
      }
    } catch (error: unknown) {
      if (session.isCurrent(generation)) {
        throw error;
      }
    }
  };

  return (
    <main className={styles.page} data-testid="protected-content">
      <header className={styles.pageHeader}>
        <div className={styles.titleBlock}>
          <p className={styles.eyebrow}>Garage inventory</p>
          <h1 className={styles.pageTitle}>Add Vehicle</h1>
        </div>
        <div className={styles.headerActions}>
          <Link className={styles.backLink ?? ''} to={VEHICLES_PATH}>
            <ArrowLeft aria-hidden="true" className={styles.icon} />
            <span>Vehicles</span>
          </Link>
        </div>
      </header>
      <VehicleForm
        lookupRegistration={(input) => getVehicleRegistrationLookup().execute(input)}
        onSubmit={saveVehicle}
        submitLabel="Add Vehicle"
      />
    </main>
  );
}

function EditVehicleFormScreen({ vehicleId }: { readonly vehicleId: VehicleId }) {
  const navigate = useNavigate();
  const mutation = useUpdateVehicleMutation();
  const query = useVehicleQuery(vehicleId);
  const session = useVehicleSessionGuard();
  const detailPath = createVehicleDetailPath(vehicleId);

  if (query.isPending) {
    return (
      <main className={styles.page} data-testid="protected-content">
        <div
          aria-label="Loading Vehicle details"
          aria-live="polite"
          className={styles.statusPanel}
          role="status"
        >
          <LoaderCircle aria-hidden="true" className={styles.spinner} />
          <p>Loading Vehicle details…</p>
        </div>
      </main>
    );
  }

  if (query.isError) {
    const notFound = query.error.category === 'not_found';
    return (
      <main className={styles.page} data-testid="protected-content">
        <header className={styles.pageHeader}>
          <div className={styles.titleBlock}>
            <p className={styles.eyebrow}>Garage inventory</p>
            <h1 className={styles.pageTitle}>{notFound ? 'Vehicle not found' : 'Edit Vehicle'}</h1>
          </div>
          <div className={styles.headerActions}>
            <Link className={styles.backLink ?? ''} to={VEHICLES_PATH}>
              <ArrowLeft aria-hidden="true" className={styles.icon} />
              <span>Vehicles</span>
            </Link>
          </div>
        </header>
        <div className={styles.statusPanel}>
          <TriangleAlert aria-hidden="true" className={styles.statusIcon} />
          <p role="alert">{getSafeVehicleErrorMessage(query.error.category)}</p>
          {!notFound && (
            <button
              className={styles.retryButton}
              onClick={() => void query.refetch()}
              type="button"
            >
              <RotateCcw aria-hidden="true" className={styles.icon} />
              <span>Try again</span>
            </button>
          )}
        </div>
      </main>
    );
  }

  const saveVehicle = async (input: CreateVehicle): Promise<void> => {
    const generation = session.capture();

    try {
      const outcome = await mutation.mutateAsync({ id: vehicleId, input });

      if (session.isCurrent(generation)) {
        navigateToSavedVehicle(
          navigate,
          outcome.vehicle.id,
        );
      }
    } catch (error: unknown) {
      if (session.isCurrent(generation)) {
        throw error;
      }
    }
  };

  return (
    <main className={styles.page} data-testid="protected-content">
      <header className={styles.pageHeader}>
        <div className={styles.titleBlock}>
          <p className={styles.eyebrow}>Garage inventory</p>
          <h1 className={styles.pageTitle}>Edit Vehicle</h1>
        </div>
        <div className={styles.headerActions}>
          <Link className={styles.backLink ?? ''} to={detailPath}>
            <ArrowLeft aria-hidden="true" className={styles.icon} />
            <span>Vehicle</span>
          </Link>
        </div>
      </header>
      <VehicleForm
        initialVehicle={query.data}
        onSubmit={saveVehicle}
        submitLabel="Save changes"
      />
    </main>
  );
}

export function VehicleFormScreen({ mode }: VehicleFormScreenProps) {
  const { vehicleId } = useParams<{ vehicleId: string }>();

  if (mode === 'create') {
    return <CreateVehicleFormScreen />;
  }

  if (vehicleId === undefined) {
    return null;
  }

  return <EditVehicleFormScreen vehicleId={vehicleId} />;
}
