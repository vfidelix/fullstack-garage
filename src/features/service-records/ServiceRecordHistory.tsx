import { FileText, LoaderCircle, Plus, RotateCcw, TriangleAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  createNewServiceRecordPath,
  createServiceRecordDetailPath,
} from '../../app/routes/routePaths';
import type { ServiceRecordSummary } from '../../application/ports/serviceRecordRepository';
import type { VehicleId } from '../../domain/vehicles/vehicle';
import { useServiceRecordsForVehicleQuery } from './serviceRecordQueries';
import styles from './ServiceRecordHistory.module.css';

const odometerFormatter = new Intl.NumberFormat('en-AU', {
  maximumFractionDigits: 0,
  useGrouping: true,
});

function getRecordLabel(record: ServiceRecordSummary): string {
  return record.displayNumber ?? `Draft from ${record.serviceDate}`;
}

function ServiceRecordRow({ record }: { readonly record: ServiceRecordSummary }) {
  const statusLabel = record.status === 'completed' ? 'Completed' : 'Draft';

  return (
    <li className={styles.listItem}>
      <Link
        aria-label={`View ${getRecordLabel(record)}`}
        className={styles.recordLink ?? ''}
        to={createServiceRecordDetailPath(record.id)}
      >
        <div>
          <p className={styles.recordTitle}>{getRecordLabel(record)}</p>
          <p className={styles.recordSummary}>{record.summary ?? 'Maintenance details not recorded'}</p>
        </div>
        <div className={styles.recordMeta}>
          <span className={styles.statusBadge}>{statusLabel}</span>
          <span>{record.serviceDate}</span>
          <span>{odometerFormatter.format(record.odometer)}</span>
        </div>
      </Link>
    </li>
  );
}

interface ServiceRecordHistoryProps {
  readonly isArchived: boolean;
  readonly vehicleId: VehicleId;
}

export function ServiceRecordHistory({ isArchived, vehicleId }: ServiceRecordHistoryProps) {
  const query = useServiceRecordsForVehicleQuery(vehicleId);

  if (query.isPending) {
    return (
      <section aria-labelledby="service-record-history-title" className={styles.section}>
        <h2 className={styles.sectionTitle} id="service-record-history-title">Service History</h2>
        <div aria-live="polite" className={styles.statusPanel} role="status">
          <LoaderCircle aria-hidden="true" className={styles.spinner} />
          <p>Loading Service Records…</p>
        </div>
      </section>
    );
  }

  if (query.isError) {
    return (
      <section aria-labelledby="service-record-history-title" className={styles.section}>
        <h2 className={styles.sectionTitle} id="service-record-history-title">Service History</h2>
        <div className={styles.statusPanel}>
          <TriangleAlert aria-hidden="true" className={styles.statusIcon} />
          <p role="alert">Service Records are temporarily unavailable. Please try again.</p>
          <button className={styles.retryButton} onClick={() => void query.refetch()} type="button">
            <RotateCcw aria-hidden="true" className={styles.icon} />
            <span>Try again</span>
          </button>
        </div>
      </section>
    );
  }

  const records = isArchived
    ? query.data.filter((record) => record.status === 'completed')
    : query.data;

  return (
    <section aria-labelledby="service-record-history-title" className={styles.section}>
      <div className={styles.sectionHeader}>
        <div>
          <p className={styles.eyebrow}>Maintenance history</p>
          <h2 className={styles.sectionTitle} id="service-record-history-title">Service History</h2>
        </div>
        {!isArchived && (
          <Link className={styles.createLink ?? ''} to={createNewServiceRecordPath(vehicleId)}>
            <Plus aria-hidden="true" className={styles.icon} />
            <span>Add Service Record</span>
          </Link>
        )}
      </div>
      {records.length === 0
        ? (
            <div className={styles.emptyState}>
              <FileText aria-hidden="true" className={styles.statusIcon} />
              <p>{isArchived ? 'No completed Service Records are retained for this archived Vehicle.' : 'No Service Records have been created for this Vehicle.'}</p>
            </div>
          )
        : (
            <ul className={styles.recordList}>
              {records.map((record) => <ServiceRecordRow key={record.id} record={record} />)}
            </ul>
          )}
    </section>
  );
}
