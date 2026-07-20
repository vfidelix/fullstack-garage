import { LoaderCircle, X } from 'lucide-react';
import {
  useEffect,
  useId,
  useRef,
} from 'react';
import type { VehicleErrorCategory } from '../../application/vehicles/vehicleResult';
import { getSafeVehicleErrorMessage } from './vehicleErrorMessages';
import styles from './VehicleWorkflowScreen.module.css';

export type VehicleLifecycleAction = 'archive' | 'delete' | 'restore';

interface VehicleLifecycleDialogProps {
  readonly action: VehicleLifecycleAction;
  readonly errorCategory?: VehicleErrorCategory;
  readonly isPending: boolean;
  readonly label: string;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}

const dialogContent: Readonly<Record<VehicleLifecycleAction, {
  readonly confirmLabel: string;
  readonly description: (label: string) => string;
  readonly pendingLabel: string;
  readonly title: string;
}>> = {
  archive: {
    confirmLabel: 'Archive Vehicle',
    description: (label) => (
      `Archive ${label}? It will leave the active list while its details and any history remain preserved.`
    ),
    pendingLabel: 'Archiving Vehicle',
    title: 'Archive Vehicle?',
  },
  delete: {
    confirmLabel: 'Delete permanently',
    description: (label) => (
      `Permanently delete ${label}? This removes the Vehicle from the garage and cannot be undone.`
    ),
    pendingLabel: 'Deleting Vehicle',
    title: 'Delete Vehicle permanently?',
  },
  restore: {
    confirmLabel: 'Restore Vehicle',
    description: (label) => (
      `Restore ${label}? It will return to the active Vehicles list.`
    ),
    pendingLabel: 'Restoring Vehicle',
    title: 'Restore Vehicle?',
  },
};

export function VehicleLifecycleDialog({
  action,
  errorCategory,
  isPending,
  label,
  onCancel,
  onConfirm,
}: VehicleLifecycleDialogProps) {
  const content = dialogContent[action];
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    returnFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    cancelButtonRef.current?.focus();

    return () => {
      returnFocusRef.current?.focus();
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(event: globalThis.KeyboardEvent): void {
      if (event.key === 'Escape') {
        event.preventDefault();

        if (!isPending) {
          onCancel();
        }

        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      if (isPending) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }

      const closeButton = closeButtonRef.current;
      const cancelButton = cancelButtonRef.current;
      const confirmButton = confirmButtonRef.current;

      if (closeButton === null || cancelButton === null || confirmButton === null) {
        return;
      }

      if (event.shiftKey && document.activeElement === closeButton) {
        event.preventDefault();
        confirmButton.focus();
      } else if (!event.shiftKey && document.activeElement === confirmButton) {
        event.preventDefault();
        closeButton.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);

    if (isPending) {
      dialogRef.current?.focus();
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isPending, onCancel]);

  return (
    <div className={styles.dialogBackdrop}>
      <div
        aria-describedby={descriptionId}
        aria-busy={isPending}
        aria-labelledby={titleId}
        aria-modal="true"
        className={styles.dialog}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className={styles.dialogHeader}>
          <h2 className={styles.dialogTitle} id={titleId}>{content.title}</h2>
          <button
            aria-label="Close confirmation"
            className={styles.dialogCloseButton}
            disabled={isPending}
            onClick={onCancel}
            ref={closeButtonRef}
            type="button"
          >
            <X aria-hidden="true" className={styles.icon} />
          </button>
        </div>
        <p className={styles.dialogDescription} id={descriptionId}>
          {content.description(label)}
        </p>
        {errorCategory !== undefined && (
          <p className={styles.dialogError} role="alert">
            {getSafeVehicleErrorMessage(errorCategory)}
          </p>
        )}
        <div className={styles.dialogActions}>
          <button
            className={styles.dialogCancelButton}
            disabled={isPending}
            onClick={onCancel}
            ref={cancelButtonRef}
            type="button"
          >
            Cancel
          </button>
          <button
            className={action === 'delete'
              ? styles.dialogDeleteButton
              : styles.dialogConfirmButton}
            disabled={isPending}
            onClick={onConfirm}
            ref={confirmButtonRef}
            type="button"
          >
            {isPending && (
              <LoaderCircle aria-hidden="true" className={styles.spinner} />
            )}
            <span>{isPending ? content.pendingLabel : content.confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
