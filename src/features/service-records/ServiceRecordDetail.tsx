import { ArrowLeft, Download, Eye, FileClock, LoaderCircle, Pencil, RotateCcw, TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { createServiceRecordEditPath, createVehicleDetailPath, VEHICLES_PATH } from '../../app/routes/routePaths';
import { calculateTotalPurchaseCostMinor, validateCompletionEligibility, type ServiceRecord, type ServiceRecordItem } from '../../domain/service-records/serviceRecord';
import {
  ServiceRecordFeatureError,
  useCompleteServiceRecordMutation,
  useDownloadServiceRecordPdfMutation,
  usePreviewHistoricalServiceRecordPdfMutation,
  usePreviewServiceRecordPdfMutation,
  useServiceRecordQuery,
  useServiceRecordSnapshotsQuery,
} from './serviceRecordQueries';
import styles from './ServiceRecordDetail.module.css';

const currencyFormatter = new Intl.NumberFormat('en-AU', { currency: 'AUD', style: 'currency' });

function formatCost(value: number): string {
  return currencyFormatter.format(value / 100);
}

function errorMessage(error: ServiceRecordFeatureError | null): string | undefined {
  if (error === null) return undefined;
  if (error.category === 'version_conflict') return 'This Service Record changed elsewhere. Reload it before trying again.';
  return error.message;
}

function downloadPdf(pdf: Blob, displayNumber: string): void {
  const objectUrl = URL.createObjectURL(pdf);
  const link = document.createElement('a');
  link.download = `${displayNumber}.pdf`;
  link.href = objectUrl;
  link.click();
  window.setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 0);
}

function RecordItems({ items }: { readonly items: readonly ServiceRecordItem[] }) {
  if (items.length === 0) return <p className={styles.empty}>No maintenance items were recorded.</p>;

  return (
    <ol className={styles.itemList}>
      {items.map((item) => (
        <li className={styles.item} key={item.id}>
          <div>
            <p className={styles.itemKind}>{item.kind}</p>
            <h3>{item.name}</h3>
            {item.notes !== undefined && <p>{item.notes}</p>}
          </div>
          {item.purchaseCostMinor !== undefined && <strong>{formatCost(item.purchaseCostMinor)}</strong>}
        </li>
      ))}
    </ol>
  );
}

function DetailFields({ record }: { readonly record: ServiceRecord }) {
  const total = calculateTotalPurchaseCostMinor(record.items);
  return (
    <>
      <dl className={styles.details}>
        <div>
          <dt>Service date</dt>
          <dd>{record.serviceDate}</dd>
        </div>
        <div>
          <dt>Odometer</dt>
          <dd>{new Intl.NumberFormat('en-AU').format(record.odometer)}</dd>
        </div>
        {record.performedBy !== undefined && (
          <div>
            <dt>Performed by</dt>
            <dd>{record.performedBy}</dd>
          </div>
        )}
        {record.location !== undefined && (
          <div>
            <dt>Location</dt>
            <dd>{record.location}</dd>
          </div>
        )}
        {record.nextServiceDueDate !== undefined && (
          <div>
            <dt>Next service due</dt>
            <dd>{record.nextServiceDueDate}</dd>
          </div>
        )}
        {record.nextServiceDueOdometer !== undefined && (
          <div>
            <dt>Next service odometer</dt>
            <dd>{new Intl.NumberFormat('en-AU').format(record.nextServiceDueOdometer)}</dd>
          </div>
        )}
      </dl>
      {record.summary !== undefined && <p className={styles.summary}>{record.summary}</p>}
      <section aria-labelledby="record-items-title" className={styles.section}>
        <div className={styles.sectionHeading}>
          <h2 id="record-items-title">Maintenance items</h2>
          <output>
            Total Parts &amp; Consumables:
            {formatCost(total)}
          </output>
        </div>
        <RecordItems items={record.items} />
      </section>
      {record.notes !== undefined && (
        <section aria-labelledby="record-notes-title" className={styles.section}>
          <h2 id="record-notes-title">Notes</h2>
          <p className={styles.notes}>{record.notes}</p>
        </section>
      )}
    </>
  );
}

function PdfPreview({ url }: { readonly url: string | undefined }) {
  if (url === undefined) return null;
  return <iframe className={styles.preview} src={url} title="Service Record PDF preview" />;
}

function DraftReview({ record }: { readonly record: ServiceRecord }) {
  const complete = useCompleteServiceRecordMutation();
  const [completeRecord, setCompleteRecord] = useState(false);
  const eligibility = validateCompletionEligibility(record);
  const submit = async (): Promise<void> => {
    try {
      await complete.mutateAsync({ id: record.id, expectedVersion: record.version });
    } catch { /* App-owned error is shown below. */ }
  };
  return (
    <>
      <div className={styles.review}>
        <h2>Completion review</h2>
        <p>Review the maintenance details carefully. Completion is irreversible: it assigns the permanent Service Record number and makes this record read-only.</p>
        <label className={styles.confirm}>
          <input checked={completeRecord} onChange={(event) => { setCompleteRecord(event.target.checked); }} type="checkbox" />
          {' '}
          I understand this Service Record will become read-only and cannot be changed.
        </label>
        {!eligibility.valid && <p className={styles.error} role="alert">Add a summary or at least one item before reviewing completion.</p>}
        {errorMessage(complete.error) !== undefined && <p role="alert">{errorMessage(complete.error)}</p>}
        <button className={styles.primaryAction} disabled={!eligibility.valid || !completeRecord || complete.isPending} onClick={() => void submit()} type="button">{complete.isPending ? 'Completing…' : 'Complete Service Record'}</button>
      </div>
      <DetailFields record={record} />
    </>
  );
}

function CompletedExports({ record }: { readonly record: ServiceRecord }) {
  const preview = usePreviewServiceRecordPdfMutation();
  const download = useDownloadServiceRecordPdfMutation();
  const historical = usePreviewHistoricalServiceRecordPdfMutation();
  const snapshots = useServiceRecordSnapshotsQuery(record.id, true);
  const historicalSnapshots = snapshots.data ?? [];
  const [previewUrl, setPreviewUrl] = useState<string>();

  useEffect(() => () => {
    if (previewUrl !== undefined) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const showPdf = (pdf: Blob): void => {
    const nextUrl = URL.createObjectURL(pdf);
    setPreviewUrl((current) => {
      if (current !== undefined) URL.revokeObjectURL(current);
      return nextUrl;
    });
  };
  const previewFresh = async (): Promise<void> => {
    try {
      showPdf((await preview.mutateAsync(record.id)).pdf);
    } catch { /* App-owned error is shown below. */ }
  };
  const downloadFresh = async (): Promise<void> => {
    try {
      const result = await download.mutateAsync(record.id);
      showPdf(result.pdf);
      downloadPdf(result.pdf, result.snapshot.displayNumber);
    } catch { /* App-owned error is shown below. */ }
  };
  const previewHistorical = async (snapshotId: string): Promise<void> => {
    try {
      showPdf((await historical.mutateAsync({ serviceRecordId: record.id, snapshotId })).pdf);
    } catch { /* App-owned error is shown below. */ }
  };

  return (
    <section aria-labelledby="exports-title" className={styles.exports}>
      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.eyebrow}>Branded record</p>
          <h2 id="exports-title">PDF export</h2>
        </div>
      </div>
      <p className={styles.exportCopy}>Preview and download use a fresh snapshot of this completed Service Record. Download stores the exact snapshot, never the PDF file.</p>
      <div className={styles.exportActions}>
        <button className={styles.secondaryAction} disabled={preview.isPending} onClick={() => void previewFresh()} type="button">
          <Eye aria-hidden="true" />
          {preview.isPending ? 'Creating preview…' : 'Preview fresh PDF'}
        </button>
        <button className={styles.primaryAction} disabled={download.isPending} onClick={() => void downloadFresh()} type="button">
          <Download aria-hidden="true" />
          {download.isPending ? 'Preparing download…' : 'Download fresh PDF'}
        </button>
      </div>
      {(errorMessage(preview.error) ?? errorMessage(download.error) ?? errorMessage(historical.error)) !== undefined && <p className={styles.error} role="alert">{errorMessage(preview.error) ?? errorMessage(download.error) ?? errorMessage(historical.error)}</p>}
      <PdfPreview url={previewUrl} />
      <div className={styles.history}>
        <h3>
          <FileClock aria-hidden="true" />
          {' '}
          Historical exports
        </h3>
        <p>Choose a stored snapshot deliberately to reproduce that historical document. Fresh actions above never select an older export.</p>
        {snapshots.isPending && (
          <p aria-live="polite">
            <LoaderCircle aria-hidden="true" className={styles.spinner} />
            {' '}
            Loading historical exports…
          </p>
        )}
        {snapshots.isError && (
          <div className={styles.error} role="alert">
            <span>Historical exports are temporarily unavailable.</span>
            <button onClick={() => void snapshots.refetch()} type="button">
              <RotateCcw aria-hidden="true" />
              {' '}
              Try again
            </button>
          </div>
        )}
        {snapshots.data !== undefined && historicalSnapshots.length === 0 && <p className={styles.empty}>No historical exports have been downloaded yet.</p>}
        {historicalSnapshots.length > 0 && (
          <ul className={styles.snapshotList}>
            {historicalSnapshots.map((snapshot) => (
              <li key={snapshot.id}>
                <span>
                  Generated
                  {snapshot.generatedAt}
                  {' '}
                  · template
                  {snapshot.templateVersion}
                  {' '}
                  · branding
                  {snapshot.brandingVersion}
                </span>
                <button className={styles.textAction} disabled={historical.isPending} onClick={() => void previewHistorical(snapshot.id)} type="button">Preview this historical export</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export function ServiceRecordDetail() {
  const { serviceRecordId } = useParams<{ serviceRecordId: string }>();
  const query = useServiceRecordQuery(serviceRecordId ?? '');
  if (query.isPending) return (
    <main className={styles.page}>
      <p aria-live="polite">
        <LoaderCircle aria-hidden="true" className={styles.spinner} />
        {' '}
        Loading Service Record…
      </p>
    </main>
  );
  if (query.isError) return (
    <main className={styles.page}>
      <p className={styles.error} role="alert">
        <TriangleAlert aria-hidden="true" />
        {' '}
        This Service Record is unavailable.
      </p>
      <button className={styles.secondaryAction} onClick={() => void query.refetch()} type="button">
        <RotateCcw aria-hidden="true" />
        {' '}
        Try again
      </button>
    </main>
  );
  const record = query.data;
  return (
    <main className={styles.page} data-testid="protected-content">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Maintenance history</p>
          <h1>{record.displayNumber ?? 'Service Record review'}</h1>
        </div>
        <nav aria-label="Service Record actions" className={styles.headerActions}>
          {record.status === 'draft' && (
            <Link className={styles.primaryAction} to={createServiceRecordEditPath(record.id)}>
              <Pencil aria-hidden="true" />
              {' '}
              Edit draft
            </Link>
          )}
          <Link className={styles.back} to={record.vehicleId === '' ? VEHICLES_PATH : createVehicleDetailPath(record.vehicleId)}>
            <ArrowLeft aria-hidden="true" />
            {' '}
            Vehicle
          </Link>
        </nav>
      </header>
      <div className={styles.identity}>
        <span className={record.status === 'completed' ? styles.completedBadge : styles.draftBadge}>{record.status === 'completed' ? 'Completed' : 'Draft review'}</span>
        {record.completedAt !== undefined && (
          <span>
            Completed
            {record.completedAt}
          </span>
        )}
      </div>
      {record.status === 'completed'
        ? (
            <>
              <DetailFields record={record} />
              <CompletedExports record={record} />
            </>
          )
        : <DraftReview record={record} />}
    </main>
  );
}
