import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  LoaderCircle,
  Pencil,
  RotateCcw,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ARCHIVED_VEHICLES_PATH,
  createVehicleDetailPath,
  createVehicleEditPath,
  VEHICLES_PATH,
} from '../../app/routes/routePaths';
import {
  formatVehicleLabel,
  type Vehicle,
  type VehicleId,
} from '../../domain/vehicles/vehicle';
import { getSafeVehicleErrorMessage } from './vehicleErrorMessages';
import { useVehicleSessionGuard } from './vehicleContext';
import {
  useArchiveVehicleMutation,
  useDeleteVehicleMutation,
  useRestoreVehicleMutation,
  useVehicleDuplicateWarning,
  useVehicleQuery,
} from './vehicleQueries';
import {
  VehicleLifecycleDialog,
  type VehicleLifecycleAction,
} from './VehicleLifecycleDialog';
import styles from './VehicleWorkflowScreen.module.css';

const odometerFormatter = new Intl.NumberFormat('en-AU', {
  maximumFractionDigits: 0,
  useGrouping: true,
});

function displayValue(value: string | number | undefined): string {
  return value === undefined || value === '' ? 'Not recorded' : String(value);
}

function VehicleDetails({ vehicle }: { readonly vehicle: Vehicle }) {
  const odometer = vehicle.currentOdometer === undefined
    ? 'Not recorded'
    : `${odometerFormatter.format(vehicle.currentOdometer)} ${vehicle.odometerUnit}`;

  return (
    <dl className={styles.detailGrid}>
      <div className={styles.detail}>
        <dt>Make</dt>
        <dd>{vehicle.make}</dd>
      </div>
      <div className={styles.detail}>
        <dt>Model</dt>
        <dd>{vehicle.model}</dd>
      </div>
      <div className={styles.detail}>
        <dt>Year</dt>
        <dd className={styles.numericValue}>{displayValue(vehicle.year)}</dd>
      </div>
      <div className={styles.detail}>
        <dt>Registration</dt>
        <dd>{displayValue(vehicle.registration)}</dd>
      </div>
      <div className={styles.detail}>
        <dt>Registration state</dt>
        <dd>{displayValue(vehicle.registrationState)}</dd>
      </div>
      <div className={styles.detail}>
        <dt>VIN</dt>
        <dd>{displayValue(vehicle.vin)}</dd>
      </div>
      <div className={styles.detail}>
        <dt>Current odometer</dt>
        <dd className={styles.numericValue}>{odometer}</dd>
      </div>
      <div className={styles.detail}>
        <dt>Odometer unit</dt>
        <dd>{vehicle.odometerUnit === 'km' ? 'Kilometres' : 'Miles'}</dd>
      </div>
      <div className={styles.detail}>
        <dt>Engine</dt>
        <dd>{displayValue(vehicle.engine)}</dd>
      </div>
      <div className={`${styles.detail ?? ''} ${styles.detailFull ?? ''}`}>
        <dt>Notes</dt>
        <dd>{displayValue(vehicle.notes)}</dd>
      </div>
    </dl>
  );
}

function VehicleDetailContent({ vehicleId }: { readonly vehicleId: VehicleId }) {
  const navigate = useNavigate();
  const query = useVehicleQuery(vehicleId);
  const duplicateWarning = useVehicleDuplicateWarning(vehicleId);
  const archiveMutation = useArchiveVehicleMutation();
  const restoreMutation = useRestoreVehicleMutation();
  const deleteMutation = useDeleteVehicleMutation();
  const session = useVehicleSessionGuard();
  const [dialogAction, setDialogAction] = useState<VehicleLifecycleAction>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionGeneration, setSubmissionGeneration] = useState<number>();
  const submissionInFlightRef = useRef(false);

  function openDialog(action: VehicleLifecycleAction): void {
    archiveMutation.reset();
    restoreMutation.reset();
    deleteMutation.reset();
    setSubmissionGeneration(undefined);
    setDialogAction(action);
  }

  function closeDialog(): void {
    if (!submissionInFlightRef.current) {
      setDialogAction(undefined);
    }
  }

  async function confirmLifecycleAction(): Promise<void> {
    if (dialogAction === undefined || submissionInFlightRef.current) {
      return;
    }

    submissionInFlightRef.current = true;
    setIsSubmitting(true);
    const generation = session.capture();
    setSubmissionGeneration(generation);

    try {
      if (dialogAction === 'archive') {
        await archiveMutation.mutateAsync(vehicleId);
        if (session.isCurrent(generation)) {
          void navigate(ARCHIVED_VEHICLES_PATH, { replace: true });
        }
      } else if (dialogAction === 'restore') {
        await restoreMutation.mutateAsync(vehicleId);
        if (session.isCurrent(generation)) {
          void navigate(VEHICLES_PATH, { replace: true });
        }
      } else {
        await deleteMutation.mutateAsync(vehicleId);
        if (session.isCurrent(generation)) {
          void navigate(
            query.data?.archivedAt === undefined
              ? VEHICLES_PATH
              : ARCHIVED_VEHICLES_PATH,
            { replace: true },
          );
        }
      }
    } catch {
      // The dialog renders only the app-owned error category exposed by the hook.
    } finally {
      if (session.isCurrent(generation)) {
        submissionInFlightRef.current = false;
        setIsSubmitting(false);
      }
    }
  }

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
            <h1 className={styles.pageTitle}>{notFound ? 'Vehicle not found' : 'Vehicle'}</h1>
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

  const vehicle = query.data;
  const label = formatVehicleLabel(vehicle);
  const isArchived = vehicle.archivedAt !== undefined;
  const activeMutation = dialogAction === 'archive'
    ? archiveMutation
    : dialogAction === 'restore'
      ? restoreMutation
      : deleteMutation;
  const activeErrorCategory = session.isCurrent(submissionGeneration)
    ? activeMutation.error?.category
    : undefined;

  return (
    <main className={styles.page} data-testid="protected-content">
      <header className={styles.pageHeader}>
        <div className={styles.titleBlock}>
          <p className={styles.eyebrow}>Vehicle details</p>
          <h1 className={styles.pageTitle}>{label}</h1>
        </div>
        <div className={styles.headerActions}>
          <Link className={styles.backLink ?? ''} to={VEHICLES_PATH}>
            <ArrowLeft aria-hidden="true" className={styles.icon} />
            <span>Vehicles</span>
          </Link>
          <Link className={styles.editLink ?? ''} to={createVehicleEditPath(vehicle.id)}>
            <Pencil aria-hidden="true" className={styles.icon} />
            <span>Edit</span>
          </Link>
        </div>
      </header>

      {duplicateWarning !== undefined && (
        <aside
          aria-label="Duplicate warning"
          className={styles.duplicateWarning}
          role="status"
        >
          <strong>Possible duplicate saved</strong>
          <p>
            Another Vehicle matches
            {' '}
            {duplicateWarning.label}
            . Your changes were saved.
          </p>
          <Link
            className={styles.backLink ?? ''}
            to={createVehicleDetailPath(duplicateWarning.vehicleId)}
          >
            View matching Vehicle
          </Link>
        </aside>
      )}

      <VehicleDetails vehicle={vehicle} />

      <section aria-labelledby="vehicle-lifecycle-title" className={styles.lifecycleSection}>
        <div>
          <p className={styles.eyebrow}>Vehicle state</p>
          <h2 className={styles.lifecycleTitle} id="vehicle-lifecycle-title">
            {isArchived ? 'Archived' : 'Active'}
          </h2>
        </div>
        <div className={styles.lifecycleActions}>
          {isArchived && (
            <button
              className={styles.restoreButton}
              onClick={() => {
                openDialog('restore');
              }}
              type="button"
            >
              <ArchiveRestore aria-hidden="true" className={styles.icon} />
              <span>Restore</span>
            </button>
          )}
          {!isArchived && (
            <button
              className={styles.archiveButton}
              onClick={() => {
                openDialog('archive');
              }}
              type="button"
            >
              <Archive aria-hidden="true" className={styles.icon} />
              <span>Archive</span>
            </button>
          )}
          <button
            className={styles.deleteButton}
            onClick={() => {
              openDialog('delete');
            }}
            type="button"
          >
            <Trash2 aria-hidden="true" className={styles.icon} />
            <span>Delete permanently</span>
          </button>
        </div>
      </section>

      {dialogAction !== undefined && (
        <VehicleLifecycleDialog
          action={dialogAction}
          isPending={isSubmitting}
          label={label}
          onCancel={closeDialog}
          onConfirm={() => {
            void confirmLifecycleAction();
          }}
          {...(activeErrorCategory === undefined
            ? {}
            : { errorCategory: activeErrorCategory })}
        />
      )}
    </main>
  );
}

export function VehicleDetailScreen() {
  const { vehicleId } = useParams<{ vehicleId: string }>();
  return vehicleId === undefined
    ? null
    : <VehicleDetailContent vehicleId={vehicleId} />;
}
