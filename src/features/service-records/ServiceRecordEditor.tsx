import { ArrowLeft, ChevronDown, ChevronUp, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { useRef, useState, type Dispatch, type KeyboardEvent, type ReactNode, type RefObject, type SetStateAction } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { createServiceRecordDetailPath, createVehicleDetailPath, VEHICLES_PATH } from '../../app/routes/routePaths';
import { calculateTotalPurchaseCostMinor, validateServiceRecordDraft, type ServiceRecord, type ServiceRecordDraftInput, type ServiceRecordItem, type ServiceRecordItemKind } from '../../domain/service-records/serviceRecord';
import { useVehicleQuery } from '../vehicles/vehicleQueries';
import { ServiceRecordFeatureError, useCreateServiceRecordDraftMutation, useDeleteServiceRecordDraftMutation, useSaveServiceRecordDraftMutation, useServiceRecordQuery, useServiceRecordsForVehicleQuery } from './serviceRecordQueries';
import styles from './ServiceRecordEditor.module.css';

export interface ServiceRecordEditorProps {
  readonly mode: 'edit' | 'new';
}

type EditableItem = Omit<ServiceRecordItem, 'sortOrder'>;

function emptyItem(kind: ServiceRecordItemKind): EditableItem {
  return { id: crypto.randomUUID(), kind, name: '' };
}

function toDraft(record: ServiceRecord, items: readonly EditableItem[]): ServiceRecordDraftInput {
  return {
    serviceDate: record.serviceDate,
    odometer: record.odometer,
    ...(record.performedBy === undefined ? {} : { performedBy: record.performedBy }),
    ...(record.location === undefined ? {} : { location: record.location }),
    ...(record.summary === undefined ? {} : { summary: record.summary }),
    ...(record.notes === undefined ? {} : { notes: record.notes }),
    ...(record.nextServiceDueDate === undefined ? {} : { nextServiceDueDate: record.nextServiceDueDate }),
    ...(record.nextServiceDueOdometer === undefined ? {} : { nextServiceDueOdometer: record.nextServiceDueOdometer }),
    items: items.map((item, sortOrder) => ({ ...item, sortOrder })),
  };
}

function dollars(minor: number): string {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(minor / 100);
}

function localToday(now = new Date()): string {
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function dollarsToMinor(value: string): number | undefined {
  const match = /^(0|[1-9]\d*)(?:\.(\d{1,2}))?$/u.exec(value);
  if (match === null) return undefined;
  const dollarsPart = Number(match[1]);
  const centsPart = Number((match[2] ?? '').padEnd(2, '0'));
  const minor = dollarsPart * 100 + centsPart;
  return Number.isSafeInteger(minor) ? minor : undefined;
}

function minorToDollars(minor: number | undefined): string {
  return minor === undefined ? '' : (minor / 100).toFixed(2);
}

const odometerFormatter = new Intl.NumberFormat('en-AU', { maximumFractionDigits: 0 });
const dateFormatter = new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
function formatBoundDate(value: string): string {
  return dateFormatter.format(new Date(`${value}T00:00:00Z`));
}
function boundMessage(earlier: Pick<ServiceRecord, 'serviceDate' | 'odometer'> | undefined, later: Pick<ServiceRecord, 'serviceDate' | 'odometer'> | undefined, unit: string): string {
  if (earlier !== undefined && later !== undefined) return `Enter an odometer between ${odometerFormatter.format(earlier.odometer)} ${unit} (completed ${formatBoundDate(earlier.serviceDate)}) and ${odometerFormatter.format(later.odometer)} ${unit} (completed ${formatBoundDate(later.serviceDate)}).`;
  if (earlier !== undefined) return `Enter at least ${odometerFormatter.format(earlier.odometer)} ${unit} to follow the completed Service Record dated ${formatBoundDate(earlier.serviceDate)}.`;
  if (later !== undefined) return `Enter no more than ${odometerFormatter.format(later.odometer)} ${unit} to precede the completed Service Record dated ${formatBoundDate(later.serviceDate)}.`;
  return 'No completed Service Records set an odometer limit for this Service Date.';
}

function mayHaveCost(kind: ServiceRecordItemKind): boolean {
  return kind === 'part' || kind === 'fluid' || kind === 'consumable';
}

function message(error: ServiceRecordFeatureError | null): string | undefined {
  if (error === null) return undefined;
  return error.category === 'version_conflict'
    ? 'This draft changed elsewhere. Reload the latest version before trying again.'
    : error.message;
}

function blockEnter(event: KeyboardEvent<HTMLElement>): boolean {
  if (event.key !== 'Enter') return false;
  event.preventDefault();
  return true;
}

function createUnsavedRecord(vehicleId: string, odometer: number | undefined): ServiceRecord {
  const now = new Date().toISOString();
  return {
    id: '',
    ownerId: '',
    vehicleId,
    status: 'draft',
    serviceDate: localToday(),
    odometer: odometer ?? 0,
    currencyCode: 'AUD',
    items: [],
    version: 0,
    createdAt: now,
    updatedAt: now,
  };
}

function hasDraftDetails(prepared: ServiceRecordDraftInput, created: ServiceRecord): boolean {
  return prepared.serviceDate !== created.serviceDate
    || prepared.odometer !== created.odometer
    || prepared.performedBy !== undefined
    || prepared.location !== undefined
    || prepared.summary !== undefined
    || prepared.notes !== undefined
    || prepared.nextServiceDueDate !== undefined
    || prepared.nextServiceDueOdometer !== undefined
    || prepared.items.length > 0;
}

interface EditorContentProps {
  readonly record: ServiceRecord;
  readonly mode: 'edit' | 'new';
}

function EditorContent({ record, mode }: EditorContentProps) {
  const navigate = useNavigate();
  const vehicle = useVehicleQuery(record.vehicleId);
  const history = useServiceRecordsForVehicleQuery(record.vehicleId);
  const create = useCreateServiceRecordDraftMutation();
  const save = useSaveServiceRecordDraftMutation();
  const remove = useDeleteServiceRecordDraftMutation();
  const [draft, setDraft] = useState(record);
  const [items, setItems] = useState<readonly EditableItem[]>(record.items);
  const [itemSections, setItemSections] = useState<Readonly<Record<string, ServiceRecordItemKind>>>(
    () => Object.fromEntries(record.items.map((item) => [item.id, item.kind])),
  );
  const focusItemIdRef = useRef<string>(undefined);
  const [costText, setCostText] = useState<Readonly<Record<string, string>>>({});

  const isArchived = vehicle.data?.archivedAt !== undefined;
  const bounds = history.data?.filter((entry) => entry.status === 'completed' && entry.id !== record.id) ?? [];
  const earlier = bounds.filter((entry) => entry.serviceDate < draft.serviceDate).sort((a, b) => b.odometer - a.odometer)[0];
  const later = bounds.filter((entry) => entry.serviceDate > draft.serviceDate).sort((a, b) => a.odometer - b.odometer)[0];
  const chronologyInvalid = (earlier !== undefined && draft.odometer < earlier.odometer) || (later !== undefined && draft.odometer > later.odometer);
  const prepared = toDraft(draft, items);
  const validation = validateServiceRecordDraft(prepared);
  const invalidFields: ReadonlySet<string> = new Set(validation.valid ? [] : validation.issues.map((issue) => issue.field));
  const hasIssue = (field: string): boolean => invalidFields.has(field);
  const total = calculateTotalPurchaseCostMinor(prepared.items);
  const isSaving = create.isPending || save.isPending;
  const update = (field: keyof ServiceRecordDraftInput, value: string | number | undefined): void => {
    setDraft((current) => ({ ...current, [field]: value }));
  };
  const updateItem = (index: number, field: keyof EditableItem, value: string | number | undefined): void => {
    setItems((current) => current.map((item, itemIndex) => (
      itemIndex === index ? { ...item, [field]: value } : item
    )));
  };
  const reorder = (index: number, direction: -1 | 1): void => {
    setItems((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const reordered = [...current];
      const currentItem = reordered[index];
      const targetItem = reordered[target];
      if (currentItem === undefined || targetItem === undefined) return current;
      reordered[index] = targetItem;
      reordered[target] = currentItem;
      return reordered;
    });
  };
  const saveDraft = async (): Promise<void> => {
    if (!validation.valid || isArchived) return;
    try {
      if (mode === 'new') {
        const created = await create.mutateAsync({
          vehicleId: record.vehicleId,
          serviceDate: prepared.serviceDate,
          odometer: prepared.odometer,
        });
        const saved = hasDraftDetails(prepared, created)
          ? await save.mutateAsync({ id: created.id, expectedVersion: created.version, draft: prepared })
          : created;
        void navigate(createServiceRecordDetailPath(saved.id));
        return;
      }
      const saved = await save.mutateAsync({ id: record.id, expectedVersion: record.version, draft: prepared });
      void navigate(createServiceRecordDetailPath(saved.id));
    } catch {
      // The safe app error is rendered below.
    }
  };
  const deleteDraft = async (): Promise<void> => {
    if (!window.confirm('Delete this draft Service Record?')) return;
    try {
      await remove.mutateAsync({ id: record.id, expectedVersion: record.version, vehicleId: record.vehicleId });
      void navigate(createVehicleDetailPath(record.vehicleId));
    } catch {
      // The safe app error is rendered below.
    }
  };

  return (
    <main className={styles.page} data-testid="protected-content">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Maintenance history</p>
          <h1>{mode === 'new' ? 'New Service Record' : 'Edit Service Record'}</h1>
        </div>
        <Link className={styles.back} to={createVehicleDetailPath(record.vehicleId)}>
          <ArrowLeft aria-hidden="true" />
          <span>Vehicle</span>
        </Link>
      </header>
      <div className={styles.identity}>
        <span>{vehicle.data === undefined ? 'Loading Vehicle…' : `${vehicle.data.make} ${vehicle.data.model}`}</span>
        <span>{vehicle.data?.odometerUnit ?? 'km'}</span>
        <span className={styles.badge}>Draft</span>
      </div>
      {isArchived && <p className={styles.error} role="alert">This Vehicle is archived and its Service Records cannot be changed.</p>}
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          void saveDraft();
        }}
      >
        <section aria-labelledby="service-details">
          <h2 id="service-details">Vehicle and Service Details</h2>
          <div className={styles.grid}>
            <Field invalid={hasIssue('serviceDate')} label="Service date">
              <span className={styles.dateControl}>
                <input aria-invalid={hasIssue('serviceDate')} aria-label="Service date" onChange={(event) => { update('serviceDate', event.target.value); }} onKeyDown={blockEnter} type="date" value={draft.serviceDate} />
                <button onClick={() => { update('serviceDate', localToday()); }} type="button">Today</button>
              </span>
            </Field>
            <Field invalid={hasIssue('odometer') || chronologyInvalid} label="Odometer"><input aria-invalid={hasIssue('odometer') || chronologyInvalid} aria-label="Odometer" min="0" onChange={(event) => { update('odometer', Number(event.target.value)); }} onKeyDown={blockEnter} type="number" value={draft.odometer} /></Field>
            <Field invalid={hasIssue('performedBy')} label="Performed by"><input aria-invalid={hasIssue('performedBy')} aria-label="Performed by" onChange={(event) => { update('performedBy', event.target.value); }} onKeyDown={blockEnter} value={draft.performedBy ?? ''} /></Field>
            <Field invalid={hasIssue('location')} label="Location"><input aria-invalid={hasIssue('location')} aria-label="Location" onChange={(event) => { update('location', event.target.value); }} onKeyDown={blockEnter} value={draft.location ?? ''} /></Field>
            <Field invalid={hasIssue('summary')} label="Summary"><input aria-invalid={hasIssue('summary')} aria-label="Summary" onChange={(event) => { update('summary', event.target.value); }} onKeyDown={blockEnter} value={draft.summary ?? ''} /></Field>
          </div>
          <p className={styles.bounds}>{boundMessage(earlier, later, vehicle.data?.odometerUnit ?? 'km')}</p>
        </section>
        <ItemSection
          title="Work Performed"
          kind="work"
          items={items}
          onAdd={(itemKind) => {
            const item = emptyItem(itemKind);
            setItems((current) => [...current, item]);
            setItemSections((current) => ({ ...current, [item.id]: 'work' }));
            focusItemIdRef.current = item.id;
          }}
          onChange={updateItem}
          onRemove={(index) => {
            setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
          }}
          onReorder={reorder}
          itemSections={itemSections}
          invalidFields={invalidFields}
          focusItemIdRef={focusItemIdRef}
          costText={costText}
          setCostText={setCostText}
        />
        <ItemSection
          title="Parts & Consumables"
          kind="part"
          items={items}
          onAdd={(itemKind) => {
            const item = emptyItem(itemKind);
            setItems((current) => [...current, item]);
            setItemSections((current) => ({ ...current, [item.id]: 'part' }));
            focusItemIdRef.current = item.id;
          }}
          onChange={updateItem}
          onRemove={(index) => {
            setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
          }}
          onReorder={reorder}
          itemSections={itemSections}
          invalidFields={invalidFields}
          focusItemIdRef={focusItemIdRef}
          costText={costText}
          setCostText={setCostText}
        />
        <ItemSection
          title="Inspections and Recommendations"
          kind="inspection"
          items={items}
          onAdd={(itemKind) => {
            const item = emptyItem(itemKind);
            setItems((current) => [...current, item]);
            setItemSections((current) => ({ ...current, [item.id]: 'inspection' }));
            focusItemIdRef.current = item.id;
          }}
          onChange={updateItem}
          onRemove={(index) => {
            setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
          }}
          onReorder={reorder}
          itemSections={itemSections}
          invalidFields={invalidFields}
          focusItemIdRef={focusItemIdRef}
          costText={costText}
          setCostText={setCostText}
        />
        <section aria-labelledby="next-service">
          <h2 id="next-service">Next Service Due</h2>
          <div className={styles.grid}>
            <Field invalid={hasIssue('nextServiceDueDate')} label="Date">
              <span className={styles.dateControl}>
                <input aria-invalid={hasIssue('nextServiceDueDate')} aria-label="Next service date" onChange={(event) => { update('nextServiceDueDate', event.target.value || undefined); }} onKeyDown={blockEnter} type="date" value={draft.nextServiceDueDate ?? ''} />
                <button onClick={() => { update('nextServiceDueDate', localToday()); }} type="button">Today</button>
              </span>
            </Field>
            <Field invalid={hasIssue('nextServiceDueOdometer')} label="Odometer"><input aria-invalid={hasIssue('nextServiceDueOdometer')} aria-label="Next service odometer" min="0" onChange={(event) => { update('nextServiceDueOdometer', event.target.value === '' ? undefined : Number(event.target.value)); }} onKeyDown={blockEnter} type="number" value={draft.nextServiceDueOdometer ?? ''} /></Field>
          </div>
        </section>
        <section aria-labelledby="notes">
          <h2 id="notes">Notes</h2>
          <Field invalid={hasIssue('notes')} label="Notes"><textarea aria-invalid={hasIssue('notes')} aria-label="Notes" onChange={(event) => { update('notes', event.target.value); }} value={draft.notes ?? ''} /></Field>
        </section>
        <output className={styles.total}>
          Total Parts &amp; Consumables:
          {dollars(total)}
        </output>
        {!validation.valid && <p className={styles.error} role="alert">Review the required Service Record details before saving.</p>}
        {message(create.error) !== undefined && <p className={styles.error} role="alert">{message(create.error)}</p>}
        {message(save.error) !== undefined && (
          <div className={styles.error} role="alert">
            <p>{message(save.error)}</p>
            {mode === 'edit' && save.error?.category === 'version_conflict' && (
              <button onClick={() => { save.reset(); }} type="button">
                <RotateCcw aria-hidden="true" />
                {' '}
                Reload latest draft
              </button>
            )}
          </div>
        )}
        {message(remove.error) !== undefined && <p className={styles.error} role="alert">{message(remove.error)}</p>}
        <div className={styles.actions}>
          {mode === 'edit' && (
            <button className={styles.delete} disabled={isArchived || remove.isPending} onClick={() => void deleteDraft()} type="button">
              <Trash2 aria-hidden="true" />
              Delete draft
            </button>
          )}
          <button className={styles.save} disabled={isArchived || chronologyInvalid || !validation.valid || isSaving} type="submit">{isSaving ? 'Saving…' : 'Save draft'}</button>
        </div>
      </form>
    </main>
  );
}

function Field({ children, invalid = false, label }: { readonly children: ReactNode; readonly invalid?: boolean; readonly label: string }) {
  const className = invalid ? [styles.field, styles.invalidField].join(' ') : styles.field;
  return (
    <label className={className}>
      <span>{label}</span>
      {children}
    </label>
  );
}

interface ItemSectionProps {
  readonly title: string;
  readonly kind: ServiceRecordItemKind;
  readonly items: readonly EditableItem[];
  readonly onAdd: (kind: ServiceRecordItemKind) => void;
  readonly onChange: (index: number, field: keyof EditableItem, value: string | number | undefined) => void;
  readonly onRemove: (index: number) => void;
  readonly onReorder: (index: number, direction: -1 | 1) => void;
  readonly itemSections: Readonly<Record<string, ServiceRecordItemKind>>;
  readonly invalidFields: ReadonlySet<string>;
  readonly focusItemIdRef: RefObject<string | undefined>;
  readonly costText: Readonly<Record<string, string>>;
  readonly setCostText: Dispatch<SetStateAction<Readonly<Record<string, string>>>>;
}
function ItemSection({ title, kind, items, onAdd, onChange, onRemove, onReorder, itemSections, invalidFields, focusItemIdRef, costText, setCostText }: ItemSectionProps) {
  const indexed = items.map((item, index) => ({ item, index })).filter(({ item }) => itemSections[item.id] === kind);
  const hasItemIssue = (index: number, field: keyof ServiceRecordItem): boolean => invalidFields.has(`items[${String(index)}].${field}`);
  return (
    <section aria-labelledby={`section-${kind}`}>
      <div className={styles.sectionHeader}>
        <h2 id={`section-${kind}`}>{title}</h2>
        <button className={styles.add} onClick={() => { onAdd(kind); }} type="button">
          <Plus aria-hidden="true" />
          Add
          {' '}
          {kind}
        </button>
        {kind === 'inspection' && (
          <button className={styles.add} onClick={() => { onAdd('other'); }} type="button">
            <Plus aria-hidden="true" />
            Add other
          </button>
        )}
      </div>
      {indexed.map(({ item, index }) => (
        <article className={styles.item} key={item.id}>
          <div className={styles.itemHeader}>
            <strong>
              Item
              {index + 1}
            </strong>
            <div>
              <button aria-label={`Move item ${String(index + 1)} up`} disabled={index === 0} onClick={() => { onReorder(index, -1); }} type="button"><ChevronUp aria-hidden="true" /></button>
              <button aria-label={`Move item ${String(index + 1)} down`} disabled={index === items.length - 1} onClick={() => { onReorder(index, 1); }} type="button"><ChevronDown aria-hidden="true" /></button>
              <button aria-label={`Remove item ${String(index + 1)}`} onClick={() => { onRemove(index); }} type="button"><Trash2 aria-hidden="true" /></button>
            </div>
          </div>
          <div className={styles.grid}>
            {kind === 'part' && (
              <Field label="Kind">
                <select
                  aria-label={`Item ${String(index + 1)} kind`}
                  onChange={(event) => { onChange(index, 'kind', event.target.value); }}
                  onKeyDown={(event) => {
                    if (!blockEnter(event)) return;
                    onAdd(item.kind);
                  }}
                  value={item.kind}
                >
                  <option value="part">Part</option>
                  <option value="fluid">Fluid</option>
                  <option value="consumable">Consumable</option>
                </select>
              </Field>
            )}
            <Field invalid={hasItemIssue(index, 'name')} label="Name">
              <input
                aria-invalid={hasItemIssue(index, 'name')}
                aria-label={`Item ${String(index + 1)} name`}
                onChange={(event) => {
                  onChange(index, 'name', event.target.value);
                }}
                onKeyDown={(event) => {
                  if (!blockEnter(event)) return;
                  onAdd(item.kind);
                }}
                ref={(element) => {
                  if (element === null || focusItemIdRef.current !== item.id) return;
                  element.focus();
                  focusItemIdRef.current = undefined;
                }}
                value={item.name}
              />
            </Field>
            {mayHaveCost(item.kind) && (
              <>
                <Field invalid={hasItemIssue(index, 'partNumber')} label="Part number">
                  <input
                    aria-invalid={hasItemIssue(index, 'partNumber')}
                    aria-label={`Item ${String(index + 1)} part number`}
                    onChange={(event) => { onChange(index, 'partNumber', event.target.value); }}
                    onKeyDown={(event) => {
                      if (!blockEnter(event)) return;
                      onAdd(item.kind);
                    }}
                    value={item.partNumber ?? ''}
                  />
                </Field>
                <Field invalid={hasItemIssue(index, 'purchaseCostMinor')} label="Purchase Cost (AUD)">
                  <input
                    aria-invalid={hasItemIssue(index, 'purchaseCostMinor')}
                    aria-label={`Item ${String(index + 1)} Purchase Cost (AUD)`}
                    inputMode="decimal"
                    onChange={(event) => {
                      const value = event.target.value;
                      setCostText((current) => ({ ...current, [item.id]: value }));
                      onChange(index, 'purchaseCostMinor', value === '' ? undefined : dollarsToMinor(value));
                    }}
                    onKeyDown={(event) => {
                      if (!blockEnter(event)) return;
                      onAdd(item.kind);
                    }}
                    pattern="[0-9]+([.][0-9]{1,2})?"
                    value={costText[item.id] ?? minorToDollars(item.purchaseCostMinor)}
                  />
                </Field>
              </>
            )}
            <Field invalid={hasItemIssue(index, 'notes')} label="Notes">
              <input
                aria-invalid={hasItemIssue(index, 'notes')}
                aria-label={`Item ${String(index + 1)} notes`}
                onChange={(event) => { onChange(index, 'notes', event.target.value); }}
                onKeyDown={(event) => {
                  if (!blockEnter(event)) return;
                  onAdd(item.kind);
                }}
                value={item.notes ?? ''}
              />
            </Field>
          </div>
        </article>
      ))}
    </section>
  );
}

function NewEditor() {
  const { vehicleId } = useParams<{ vehicleId: string }>();
  const vehicle = useVehicleQuery(vehicleId ?? '');
  if (vehicleId === undefined) return (
    <main className={styles.page}>
      <p role="alert">Select a Vehicle before creating a Service Record.</p>
      <Link className={styles.back} to={VEHICLES_PATH}>Vehicles</Link>
    </main>
  );
  if (vehicle.isPending) return <main className={styles.page}>Loading Vehicle…</main>;
  if (vehicle.isError) return <main className={styles.page}><p role="alert">This Vehicle is unavailable.</p></main>;
  return <EditorContent key={vehicleId} mode="new" record={createUnsavedRecord(vehicleId, vehicle.data.currentOdometer)} />;
}

export function ServiceRecordEditor({ mode }: ServiceRecordEditorProps) {
  const { serviceRecordId } = useParams<{ serviceRecordId: string }>();
  const query = useServiceRecordQuery(serviceRecordId ?? '');
  if (mode === 'new') return <NewEditor />;
  if (query.isPending) return <main className={styles.page}>Loading Service Record…</main>;
  if (query.isError || query.data.status !== 'draft') return <main className={styles.page}><p role="alert">This Service Record cannot be edited.</p></main>;
  return <EditorContent key={`${query.data.id}-${String(query.data.version)}`} mode={mode} record={query.data} />;
}
