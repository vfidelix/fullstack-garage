/* eslint-disable @stylistic/max-statements-per-line -- Strict provider-row guards intentionally remain adjacent to their mappings. */
import {
  isCalendarDate,
  validateServiceRecordDraft,
  type ServiceRecord,
  type ServiceRecordItem,
  type ServiceRecordItemKind,
} from '../../../domain/service-records/serviceRecord';
import type { ServiceRecordSummary } from '../../../application/ports/serviceRecordRepository';
import type { ServiceRecordSnapshotSummary } from '../../../application/ports/serviceRecordSnapshotRepository';

type Row = Readonly<Record<string, unknown>>;
const UUID = /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/iu;
const KINDS = new Set<ServiceRecordItemKind>(['work', 'part', 'fluid', 'consumable', 'inspection', 'other']);
const isRow = (value: unknown): value is Row => typeof value === 'object' && value !== null && !Array.isArray(value);
const id = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);
const timestamp = (value: unknown): value is string => typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Date.parse(value));
const nullableText = (value: unknown): value is string | null => value === null || typeof value === 'string';
const nullableInteger = (input: unknown): input is number | null => input === null || (typeof input === 'number' && Number.isSafeInteger(input) && input >= 0);
const integer = (input: unknown): input is number => typeof input === 'number' && Number.isSafeInteger(input);

function optional(row: Row, key: string): string | undefined { return row[key] === null ? undefined : row[key] as string; }
function optionalInteger(row: Row, key: string): number | undefined { return row[key] === null ? undefined : row[key] as number; }

export function mapServiceRecordItemRow(value: unknown): ServiceRecordItem | null {
  if (!isRow(value) || !id(value.id) || typeof value.kind !== 'string' || !KINDS.has(value.kind as ServiceRecordItemKind) || typeof value.name !== 'string' || !nullableText(value.category) || !nullableText(value.brand) || !nullableText(value.specification) || !nullableText(value.part_number) || !nullableText(value.supplier) || !(value.quantity === null || (typeof value.quantity === 'number' && Number.isFinite(value.quantity))) || !nullableText(value.unit) || !nullableInteger(value.purchase_cost_minor) || !nullableText(value.notes) || !integer(value.sort_order) || value.sort_order < 0) return null;
  const row = value as Row & { readonly id: string; readonly kind: ServiceRecordItemKind; readonly name: string; readonly sort_order: number; readonly category: string | null; readonly brand: string | null; readonly specification: string | null; readonly part_number: string | null; readonly supplier: string | null; readonly quantity: number | null; readonly unit: string | null; readonly purchase_cost_minor: number | null; readonly notes: string | null };
  return { id: row.id, kind: row.kind, name: row.name, sortOrder: row.sort_order, ...(row.category === null ? {} : { category: row.category }), ...(row.brand === null ? {} : { brand: row.brand }), ...(row.specification === null ? {} : { specification: row.specification }), ...(row.part_number === null ? {} : { partNumber: row.part_number }), ...(row.supplier === null ? {} : { supplier: row.supplier }), ...(row.quantity === null ? {} : { quantity: row.quantity }), ...(row.unit === null ? {} : { unit: row.unit }), ...(row.purchase_cost_minor === null ? {} : { purchaseCostMinor: row.purchase_cost_minor }), ...(row.notes === null ? {} : { notes: row.notes }) };
}

export function mapServiceRecordRow(value: unknown): ServiceRecord | null {
  if (!isRow(value) || !id(value.id) || !id(value.owner_id) || !id(value.vehicle_id) || (value.status !== 'draft' && value.status !== 'completed') || typeof value.service_date !== 'string' || !isCalendarDate(value.service_date) || !integer(value.odometer) || value.odometer < 0 || !nullableText(value.display_number) || !nullableText(value.performed_by) || !nullableText(value.location) || !nullableText(value.summary) || !nullableText(value.notes) || !(value.next_service_due_date === null || (typeof value.next_service_due_date === 'string' && isCalendarDate(value.next_service_due_date))) || !nullableInteger(value.next_service_due_odometer) || value.currency_code !== 'AUD' || !integer(value.version) || value.version < 1 || !timestamp(value.created_at) || !timestamp(value.updated_at) || !(value.completed_at === null || timestamp(value.completed_at)) || !Array.isArray(value.service_record_items)) return null;
  const row = value as Row & { readonly id: string; readonly owner_id: string; readonly vehicle_id: string; readonly status: 'draft' | 'completed'; readonly service_date: string; readonly odometer: number; readonly version: number; readonly created_at: string; readonly updated_at: string; readonly service_record_items: unknown[] };
  const mappedItems = value.service_record_items.map(mapServiceRecordItemRow);
  if (mappedItems.some((item) => item === null)) return null;
  const items = (mappedItems as ServiceRecordItem[])
    .sort((left, right) => left.sortOrder - right.sortOrder);
  const displayNumber = optional(value, 'display_number'); const performedBy = optional(value, 'performed_by'); const location = optional(value, 'location'); const summary = optional(value, 'summary'); const notes = optional(value, 'notes'); const nextServiceDueDate = optional(value, 'next_service_due_date'); const nextServiceDueOdometer = optionalInteger(value, 'next_service_due_odometer'); const completedAt = optional(value, 'completed_at');
  const record: ServiceRecord = { id: row.id, ownerId: row.owner_id, vehicleId: row.vehicle_id, status: row.status, serviceDate: row.service_date, odometer: row.odometer, currencyCode: 'AUD', items, version: row.version, createdAt: row.created_at, updatedAt: row.updated_at, ...(displayNumber === undefined ? {} : { displayNumber }), ...(performedBy === undefined ? {} : { performedBy }), ...(location === undefined ? {} : { location }), ...(summary === undefined ? {} : { summary }), ...(notes === undefined ? {} : { notes }), ...(nextServiceDueDate === undefined ? {} : { nextServiceDueDate }), ...(nextServiceDueOdometer === undefined ? {} : { nextServiceDueOdometer }), ...(completedAt === undefined ? {} : { completedAt }) };
  if (!validateServiceRecordDraft(record).valid || (record.status === 'draft' && (record.displayNumber !== undefined || record.completedAt !== undefined)) || (record.status === 'completed' && (record.displayNumber === undefined || record.completedAt === undefined))) return null;
  return record;
}

export function mapServiceRecordSummaryRow(value: unknown): ServiceRecordSummary | null {
  if (!isRow(value) || !id(value.id) || !id(value.vehicle_id) || (value.status !== 'draft' && value.status !== 'completed') || typeof value.service_date !== 'string' || !isCalendarDate(value.service_date) || !integer(value.odometer) || value.odometer < 0 || !nullableText(value.display_number) || !nullableText(value.summary) || value.currency_code !== 'AUD' || !integer(value.version) || value.version < 1 || !(value.completed_at === null || timestamp(value.completed_at)) || !Array.isArray(value.service_record_items)) return null;
  const row = value as Row & { readonly id: string; readonly vehicle_id: string; readonly status: 'draft' | 'completed'; readonly service_date: string; readonly odometer: number; readonly version: number; readonly service_record_items: unknown[] };
  const costs: number[] = [];
  for (const item of row.service_record_items) { if (!isRow(item) || !nullableInteger(item.purchase_cost_minor)) return null; costs.push(item.purchase_cost_minor ?? 0); }
  const displayNumber = optional(value, 'display_number'); const summary = optional(value, 'summary'); const completedAt = optional(value, 'completed_at');
  return { id: row.id, vehicleId: row.vehicle_id, status: row.status, serviceDate: row.service_date, odometer: row.odometer, currencyCode: 'AUD', totalPurchaseCostMinor: costs.reduce((total, cost) => total + cost, 0), version: row.version, ...(displayNumber === undefined ? {} : { displayNumber }), ...(summary === undefined ? {} : { summary }), ...(completedAt === undefined ? {} : { completedAt }) };
}

export function mapServiceRecordSnapshotSummaryRow(value: unknown): ServiceRecordSnapshotSummary | null {
  if (!isRow(value) || !id(value.id) || !id(value.service_record_id) || !integer(value.service_record_version) || value.service_record_version < 1 || !integer(value.schema_version) || value.schema_version < 1 || !integer(value.template_version) || value.template_version < 1 || !integer(value.branding_version) || value.branding_version < 1 || !timestamp(value.created_at) || !isRow(value.snapshot) || typeof value.snapshot.displayNumber !== 'string') return null;
  const row = value as Row & { readonly id: string; readonly service_record_id: string; readonly service_record_version: number; readonly schema_version: number; readonly template_version: number; readonly branding_version: number; readonly created_at: string; readonly snapshot: Row & { readonly displayNumber: string } };
  return { id: row.id, serviceRecordId: row.service_record_id, displayNumber: row.snapshot.displayNumber, serviceRecordVersion: row.service_record_version, schemaVersion: row.schema_version, templateVersion: row.template_version, brandingVersion: row.branding_version, generatedAt: row.created_at };
}
