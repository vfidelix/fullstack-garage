import { ArrowLeft } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { createVehicleDetailPath, VEHICLES_PATH } from '../../app/routes/routePaths';
import styles from './ServiceRecordRoutePlaceholder.module.css';

interface ServiceRecordRoutePlaceholderProps {
  readonly mode: 'detail' | 'edit' | 'new';
}

export function ServiceRecordRoutePlaceholder({ mode }: ServiceRecordRoutePlaceholderProps) {
  const { vehicleId } = useParams<{ vehicleId: string }>();
  const title = mode === 'new'
    ? 'New Service Record'
    : mode === 'edit'
      ? 'Edit Service Record'
      : 'Service Record';
  const backPath = vehicleId === undefined ? VEHICLES_PATH : createVehicleDetailPath(vehicleId);

  return (
    <main className={styles.page} data-testid="protected-content">
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Maintenance history</p>
          <h1 className={styles.pageTitle}>{title}</h1>
        </div>
        <Link className={styles.backLink ?? ''} to={backPath}>
          <ArrowLeft aria-hidden="true" className={styles.icon} />
          <span>Vehicles</span>
        </Link>
      </header>
    </main>
  );
}
