import type { AppUserId } from '../users/appUser';
import type { VehicleId } from '../vehicles/vehicle';

export const SERVICE_RECORD_TEXT_MAX_LENGTH = 200;
export const SERVICE_RECORD_PERFORMED_BY_MAX_LENGTH = 100;
export const SERVICE_RECORD_LOCATION_MAX_LENGTH = 200;
export const SERVICE_RECORD_NOTES_MAX_LENGTH = 2_000;
export const SERVICE_RECORD_ITEM_CATEGORY_MAX_LENGTH = 50;
export const SERVICE_RECORD_ITEM_NAME_MAX_LENGTH = 200;
export const SERVICE_RECORD_ITEM_BRAND_MAX_LENGTH = 100;
export const SERVICE_RECORD_ITEM_SPECIFICATION_MAX_LENGTH = 200;
export const SERVICE_RECORD_ITEM_PART_NUMBER_MAX_LENGTH = 100;
export const SERVICE_RECORD_ITEM_SUPPLIER_MAX_LENGTH = 100;
export const SERVICE_RECORD_ITEM_UNIT_MAX_LENGTH = 20;
export const SERVICE_RECORD_ITEM_NOTES_MAX_LENGTH = 1_000;
export const SERVICE_RECORD_CURRENCY_CODE = 'AUD';

export type ServiceRecordId = string;
export type ServiceRecordItemId = string;
export type ServiceRecordSnapshotId = string;
export type ServiceRecordStatus = 'draft' | 'completed';
export type ServiceRecordItemKind
  = | 'work'
    | 'part'
    | 'fluid'
    | 'consumable'
    | 'inspection'
    | 'other';

export interface ServiceRecordItem {
  readonly id: ServiceRecordItemId;
  readonly kind: ServiceRecordItemKind;
  readonly category?: string;
  readonly name: string;
  readonly brand?: string;
  readonly specification?: string;
  readonly partNumber?: string;
  readonly supplier?: string;
  readonly quantity?: number;
  readonly unit?: string;
  readonly purchaseCostMinor?: number;
  readonly notes?: string;
  readonly sortOrder: number;
}

export interface ServiceRecord {
  readonly id: ServiceRecordId;
  readonly ownerId: AppUserId;
  readonly vehicleId: VehicleId;
  readonly displayNumber?: string;
  readonly status: ServiceRecordStatus;
  readonly serviceDate: string;
  readonly odometer: number;
  readonly performedBy?: string;
  readonly location?: string;
  readonly summary?: string;
  readonly notes?: string;
  readonly nextServiceDueDate?: string;
  readonly nextServiceDueOdometer?: number;
  readonly currencyCode: typeof SERVICE_RECORD_CURRENCY_CODE;
  readonly items: readonly ServiceRecordItem[];
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly completedAt?: string;
}

export interface ServiceRecordDraftInput {
  readonly serviceDate: string;
  readonly odometer: number;
  readonly performedBy?: string;
  readonly location?: string;
  readonly summary?: string;
  readonly notes?: string;
  readonly nextServiceDueDate?: string;
  readonly nextServiceDueOdometer?: number;
  readonly items: readonly ServiceRecordItem[];
}

export type ServiceRecordInputField
  = | 'serviceDate'
    | 'odometer'
    | 'performedBy'
    | 'location'
    | 'summary'
    | 'notes'
    | 'nextServiceDueDate'
    | 'nextServiceDueOdometer'
    | 'items'
    | `items[${number}].${keyof ServiceRecordItem}`
    | 'completion';

export type ServiceRecordValidationIssueCode
  = | 'required'
    | 'too_long'
    | 'invalid_date'
    | 'invalid_odometer'
    | 'invalid_quantity'
    | 'invalid_cost'
    | 'cost_not_allowed'
    | 'invalid_order'
    | 'must_be_after_service_date'
    | 'must_be_greater_than_odometer'
    | 'summary_or_item_required'
    | 'invalid_version'
    | 'invalid_completed_state';

export interface ServiceRecordValidationIssue {
  readonly field: ServiceRecordInputField;
  readonly code: ServiceRecordValidationIssueCode;
}

export type ServiceRecordValidationResult<T>
  = | { readonly valid: true; readonly value: T }
    | { readonly valid: false; readonly issues: readonly ServiceRecordValidationIssue[] };

export interface OdometerChronologyIssue {
  readonly code: 'below_earlier_bound' | 'above_later_bound';
  readonly bound: number;
}

export type OdometerChronologyValidation
  = | { readonly valid: true }
    | { readonly valid: false; readonly issue: OdometerChronologyIssue };

export interface ServiceRecordSnapshotVehicle {
  readonly make: string;
  readonly model: string;
  readonly year?: string;
  readonly registration?: string;
  readonly registrationState?: string;
  readonly vin?: string;
  readonly engine?: string;
  readonly odometerUnit: 'km' | 'mi';
}

export interface ServiceRecordSnapshot {
  readonly id: ServiceRecordSnapshotId;
  readonly schemaVersion: number;
  readonly templateVersion: number;
  readonly brandingVersion: number;
  readonly serviceRecordId: ServiceRecordId;
  readonly displayNumber: string;
  readonly status: 'completed';
  readonly serviceRecordVersion: number;
  readonly serviceDate: string;
  readonly generatedAt: string;
  readonly createdById: AppUserId;
  readonly vehicle: Readonly<ServiceRecordSnapshotVehicle>;
  readonly odometer: number;
  readonly performedBy?: string;
  readonly location?: string;
  readonly summary?: string;
  readonly notes?: string;
  readonly nextServiceDueDate?: string;
  readonly nextServiceDueOdometer?: number;
  readonly currencyCode: typeof SERVICE_RECORD_CURRENCY_CODE;
  readonly items: readonly Readonly<ServiceRecordItem>[];
  readonly totalPurchaseCostMinor: number;
}

export interface CreateServiceRecordSnapshotInput {
  readonly id: ServiceRecordSnapshotId;
  readonly schemaVersion: number;
  readonly templateVersion: number;
  readonly brandingVersion: number;
  readonly generatedAt: string;
  readonly createdById: AppUserId;
  readonly record: ServiceRecord;
  readonly vehicle: ServiceRecordSnapshotVehicle;
}

function countTextCharacters(value: string): number {
  return Array.from(value).length;
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalized = value.trim();
  return normalized === '' ? undefined : normalized;
}

function normalizeItem(item: ServiceRecordItem): ServiceRecordItem {
  const category = normalizeOptionalText(item.category);
  const brand = normalizeOptionalText(item.brand);
  const specification = normalizeOptionalText(item.specification);
  const partNumber = normalizeOptionalText(item.partNumber);
  const supplier = normalizeOptionalText(item.supplier);
  const unit = normalizeOptionalText(item.unit);
  const notes = normalizeOptionalText(item.notes);

  return {
    ...item,
    name: item.name.trim(),
    ...(category === undefined ? {} : { category }),
    ...(brand === undefined ? {} : { brand }),
    ...(specification === undefined ? {} : { specification }),
    ...(partNumber === undefined ? {} : { partNumber }),
    ...(supplier === undefined ? {} : { supplier }),
    ...(unit === undefined ? {} : { unit }),
    ...(notes === undefined ? {} : { notes }),
  };
}

export function normalizeServiceRecordDraft(input: ServiceRecordDraftInput): ServiceRecordDraftInput {
  const performedBy = normalizeOptionalText(input.performedBy);
  const location = normalizeOptionalText(input.location);
  const summary = normalizeOptionalText(input.summary);
  const notes = normalizeOptionalText(input.notes);

  return {
    serviceDate: input.serviceDate,
    odometer: input.odometer,
    ...(input.nextServiceDueDate === undefined ? {} : { nextServiceDueDate: input.nextServiceDueDate }),
    ...(input.nextServiceDueOdometer === undefined
      ? {}
      : { nextServiceDueOdometer: input.nextServiceDueOdometer }),
    ...(performedBy === undefined ? {} : { performedBy }),
    ...(location === undefined ? {} : { location }),
    ...(summary === undefined ? {} : { summary }),
    ...(notes === undefined ? {} : { notes }),
    items: input.items.map(normalizeItem),
  };
}

export function isCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) {
    return false;
  }

  const [, year, month, day] = match;
  const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return parsed.getUTCFullYear() === Number(year)
    && parsed.getUTCMonth() === Number(month) - 1
    && parsed.getUTCDate() === Number(day);
}

function validateOptionalText(
  value: string | undefined,
  field: ServiceRecordInputField,
  maximumLength: number,
  issues: ServiceRecordValidationIssue[],
): void {
  if (value !== undefined && countTextCharacters(value) > maximumLength) {
    issues.push({ field, code: 'too_long' });
  }
}

function isNonNegativeSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function itemField(index: number, field: keyof ServiceRecordItem): ServiceRecordInputField {
  return `items[${String(index)}].${field}` as ServiceRecordInputField;
}

function hasContiguousOrdering(items: readonly ServiceRecordItem[]): boolean {
  const orders = items.map((item) => item.sortOrder).sort((left, right) => left - right);
  return orders.every((sortOrder, index) => Number.isSafeInteger(sortOrder) && sortOrder === index);
}

function mayHavePurchaseCost(kind: ServiceRecordItemKind): boolean {
  return kind === 'part' || kind === 'fluid' || kind === 'consumable';
}

function validateItems(
  items: readonly ServiceRecordItem[],
  issues: ServiceRecordValidationIssue[],
): void {
  items.forEach((item, index) => {
    if (countTextCharacters(item.name) === 0) {
      issues.push({ field: itemField(index, 'name'), code: 'required' });
    } else if (countTextCharacters(item.name) > SERVICE_RECORD_ITEM_NAME_MAX_LENGTH) {
      issues.push({ field: itemField(index, 'name'), code: 'too_long' });
    }

    validateOptionalText(item.category, itemField(index, 'category'), SERVICE_RECORD_ITEM_CATEGORY_MAX_LENGTH, issues);
    validateOptionalText(item.brand, itemField(index, 'brand'), SERVICE_RECORD_ITEM_BRAND_MAX_LENGTH, issues);
    validateOptionalText(item.specification, itemField(index, 'specification'), SERVICE_RECORD_ITEM_SPECIFICATION_MAX_LENGTH, issues);
    validateOptionalText(item.partNumber, itemField(index, 'partNumber'), SERVICE_RECORD_ITEM_PART_NUMBER_MAX_LENGTH, issues);
    validateOptionalText(item.supplier, itemField(index, 'supplier'), SERVICE_RECORD_ITEM_SUPPLIER_MAX_LENGTH, issues);
    validateOptionalText(item.unit, itemField(index, 'unit'), SERVICE_RECORD_ITEM_UNIT_MAX_LENGTH, issues);
    validateOptionalText(item.notes, itemField(index, 'notes'), SERVICE_RECORD_ITEM_NOTES_MAX_LENGTH, issues);

    if (item.quantity !== undefined && (!Number.isFinite(item.quantity) || item.quantity <= 0)) {
      issues.push({ field: itemField(index, 'quantity'), code: 'invalid_quantity' });
    }

    if (item.purchaseCostMinor !== undefined) {
      if (!mayHavePurchaseCost(item.kind)) {
        issues.push({ field: itemField(index, 'purchaseCostMinor'), code: 'cost_not_allowed' });
      } else if (!isNonNegativeSafeInteger(item.purchaseCostMinor)) {
        issues.push({ field: itemField(index, 'purchaseCostMinor'), code: 'invalid_cost' });
      }
    }
  });

  if (!hasContiguousOrdering(items)) {
    issues.push({ field: 'items', code: 'invalid_order' });
  }
}

export function validateServiceRecordDraft(
  input: ServiceRecordDraftInput,
): ServiceRecordValidationResult<ServiceRecordDraftInput> {
  const normalized = normalizeServiceRecordDraft(input);
  const issues: ServiceRecordValidationIssue[] = [];

  if (!isCalendarDate(normalized.serviceDate)) {
    issues.push({ field: 'serviceDate', code: 'invalid_date' });
  }
  if (!isNonNegativeSafeInteger(normalized.odometer)) {
    issues.push({ field: 'odometer', code: 'invalid_odometer' });
  }

  validateOptionalText(normalized.performedBy, 'performedBy', SERVICE_RECORD_PERFORMED_BY_MAX_LENGTH, issues);
  validateOptionalText(normalized.location, 'location', SERVICE_RECORD_LOCATION_MAX_LENGTH, issues);
  validateOptionalText(normalized.summary, 'summary', SERVICE_RECORD_TEXT_MAX_LENGTH, issues);
  validateOptionalText(normalized.notes, 'notes', SERVICE_RECORD_NOTES_MAX_LENGTH, issues);

  if (normalized.nextServiceDueDate !== undefined) {
    if (!isCalendarDate(normalized.nextServiceDueDate)) {
      issues.push({ field: 'nextServiceDueDate', code: 'invalid_date' });
    } else if (isCalendarDate(normalized.serviceDate) && normalized.nextServiceDueDate <= normalized.serviceDate) {
      issues.push({ field: 'nextServiceDueDate', code: 'must_be_after_service_date' });
    }
  }
  if (normalized.nextServiceDueOdometer !== undefined) {
    if (!isNonNegativeSafeInteger(normalized.nextServiceDueOdometer)) {
      issues.push({ field: 'nextServiceDueOdometer', code: 'invalid_odometer' });
    } else if (isNonNegativeSafeInteger(normalized.odometer)
      && normalized.nextServiceDueOdometer <= normalized.odometer) {
      issues.push({ field: 'nextServiceDueOdometer', code: 'must_be_greater_than_odometer' });
    }
  }

  validateItems(normalized.items, issues);
  return issues.length === 0 ? { valid: true, value: normalized } : { valid: false, issues };
}

export function validateCompletionEligibility(
  record: ServiceRecord,
): ServiceRecordValidationResult<ServiceRecord> {
  const draftValidation = validateServiceRecordDraft(record);
  const issues = draftValidation.valid ? [] : [...draftValidation.issues];

  if (record.status !== 'draft') {
    issues.push({ field: 'completion', code: 'invalid_completed_state' });
  }
  if ((record.summary?.trim() ?? '') === '' && record.items.length === 0) {
    issues.push({ field: 'completion', code: 'summary_or_item_required' });
  }
  if (!Number.isSafeInteger(record.version) || record.version < 1) {
    issues.push({ field: 'completion', code: 'invalid_version' });
  }

  return issues.length === 0 ? { valid: true, value: record } : { valid: false, issues };
}

export function calculateTotalPurchaseCostMinor(items: readonly ServiceRecordItem[]): number {
  return items.reduce((total, item) => total + (item.purchaseCostMinor ?? 0), 0);
}

export function validateOdometerChronology(
  serviceDate: string,
  odometer: number,
  completedHistory: readonly ServiceRecord[],
): OdometerChronologyValidation {
  const completed = completedHistory.filter((record) => record.status === 'completed');
  const earlier = completed
    .filter((record) => record.serviceDate < serviceDate)
    .reduce<number | undefined>((bound, record) => bound === undefined ? record.odometer : Math.max(bound, record.odometer), undefined);
  const later = completed
    .filter((record) => record.serviceDate > serviceDate)
    .reduce<number | undefined>((bound, record) => bound === undefined ? record.odometer : Math.min(bound, record.odometer), undefined);

  if (earlier !== undefined && odometer < earlier) {
    return { valid: false, issue: { code: 'below_earlier_bound', bound: earlier } };
  }
  if (later !== undefined && odometer > later) {
    return { valid: false, issue: { code: 'above_later_bound', bound: later } };
  }
  return { valid: true };
}

export function advanceVehicleOdometer(
  currentOdometer: number | undefined,
  serviceRecordOdometer: number,
): number {
  return currentOdometer === undefined
    ? serviceRecordOdometer
    : Math.max(currentOdometer, serviceRecordOdometer);
}

function freezeItem(item: ServiceRecordItem): Readonly<ServiceRecordItem> {
  return Object.freeze({ ...item });
}

export function createServiceRecordSnapshot(
  input: CreateServiceRecordSnapshotInput,
): ServiceRecordSnapshot {
  const { record } = input;
  if (record.status !== 'completed' || record.displayNumber === undefined) {
    throw new Error('Only completed Service Records with a display number can be snapshotted.');
  }

  const items = Object.freeze([...record.items]
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map(freezeItem));
  const vehicle = Object.freeze({ ...input.vehicle });
  return Object.freeze({
    id: input.id,
    schemaVersion: input.schemaVersion,
    templateVersion: input.templateVersion,
    brandingVersion: input.brandingVersion,
    serviceRecordId: record.id,
    displayNumber: record.displayNumber,
    status: 'completed',
    serviceRecordVersion: record.version,
    serviceDate: record.serviceDate,
    generatedAt: input.generatedAt,
    createdById: input.createdById,
    vehicle,
    odometer: record.odometer,
    ...(record.performedBy === undefined ? {} : { performedBy: record.performedBy }),
    ...(record.location === undefined ? {} : { location: record.location }),
    ...(record.summary === undefined ? {} : { summary: record.summary }),
    ...(record.notes === undefined ? {} : { notes: record.notes }),
    ...(record.nextServiceDueDate === undefined ? {} : { nextServiceDueDate: record.nextServiceDueDate }),
    ...(record.nextServiceDueOdometer === undefined ? {} : { nextServiceDueOdometer: record.nextServiceDueOdometer }),
    currencyCode: record.currencyCode,
    items,
    totalPurchaseCostMinor: calculateTotalPurchaseCostMinor(items),
  });
}
