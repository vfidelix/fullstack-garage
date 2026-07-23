import { describe, expect, it } from 'vitest';

import {
  SERVICE_RECORD_ITEM_NAME_MAX_LENGTH,
  SERVICE_RECORD_NOTES_MAX_LENGTH,
  SERVICE_RECORD_TEXT_MAX_LENGTH,
  advanceVehicleOdometer,
  calculateTotalPurchaseCostMinor,
  createServiceRecordSnapshot,
  validateCompletionEligibility,
  validateOdometerChronology,
  validateServiceRecordDraft,
  type ServiceRecord,
  type ServiceRecordDraftInput,
} from './serviceRecord';

const validDraft: ServiceRecordDraftInput = {
  serviceDate: '2026-07-22',
  odometer: 42_000,
  items: [],
};

function draft(overrides: Partial<ServiceRecord> = {}): ServiceRecord {
  return {
    id: 'record-1',
    ownerId: 'owner-1',
    vehicleId: 'vehicle-1',
    status: 'draft',
    serviceDate: '2026-07-22',
    odometer: 42_000,
    currencyCode: 'AUD',
    items: [],
    version: 1,
    createdAt: '2026-07-22T09:00:00.000Z',
    updatedAt: '2026-07-22T09:00:00.000Z',
    ...overrides,
  };
}

describe('Service Record domain', () => {
  it.each(['2026-02-29', '2026-04-31', '2026-1-01', '2026-01-1', '2026-01-01T00:00:00Z'])(
    'rejects a non-calendar service date: %s',
    (serviceDate) => {
      expect(validateServiceRecordDraft({ ...validDraft, serviceDate })).toEqual({
        valid: false,
        issues: [{ field: 'serviceDate', code: 'invalid_date' }],
      });
    },
  );

  it('accepts leap-day dates and normalizes optional text', () => {
    expect(validateServiceRecordDraft({
      ...validDraft,
      serviceDate: '2028-02-29',
      performedBy: '  Garage Admin  ',
      location: '   ',
    })).toEqual({
      valid: true,
      value: { ...validDraft, serviceDate: '2028-02-29', performedBy: 'Garage Admin' },
    });
  });

  it('enforces record text and odometer boundaries', () => {
    expect(validateServiceRecordDraft({
      ...validDraft,
      summary: 'S'.repeat(SERVICE_RECORD_TEXT_MAX_LENGTH),
      notes: 'N'.repeat(SERVICE_RECORD_NOTES_MAX_LENGTH),
      odometer: Number.MAX_SAFE_INTEGER,
    }).valid).toBe(true);

    expect(validateServiceRecordDraft({
      ...validDraft,
      summary: 'S'.repeat(SERVICE_RECORD_TEXT_MAX_LENGTH + 1),
      odometer: -1,
    })).toEqual({
      valid: false,
      issues: [
        { field: 'odometer', code: 'invalid_odometer' },
        { field: 'summary', code: 'too_long' },
      ],
    });
  });

  it('enforces kind-specific costs, item bounds, quantities, and contiguous order', () => {
    expect(validateServiceRecordDraft({
      ...validDraft,
      items: [
        { id: 'work', kind: 'work', name: ' Oil change ', purchaseCostMinor: 0, sortOrder: 0 },
        { id: 'part', kind: 'part', name: 'X'.repeat(SERVICE_RECORD_ITEM_NAME_MAX_LENGTH + 1), quantity: 0, purchaseCostMinor: 1.5, sortOrder: 2 },
      ],
    })).toEqual({
      valid: false,
      issues: [
        { field: 'items[0].purchaseCostMinor', code: 'cost_not_allowed' },
        { field: 'items[1].name', code: 'too_long' },
        { field: 'items[1].quantity', code: 'invalid_quantity' },
        { field: 'items[1].purchaseCostMinor', code: 'invalid_cost' },
        { field: 'items', code: 'invalid_order' },
      ],
    });
  });

  it('calculates only eligible integer minor-unit purchase costs', () => {
    expect(calculateTotalPurchaseCostMinor([
      { id: 'work', kind: 'work', name: 'Inspect', sortOrder: 0 },
      { id: 'oil', kind: 'fluid', name: 'Oil', purchaseCostMinor: 7_299, sortOrder: 1 },
      { id: 'filter', kind: 'part', name: 'Filter', purchaseCostMinor: 0, sortOrder: 2 },
    ])).toBe(7_299);
  });

  it('requires a completed record to have a summary or item and valid next-service values', () => {
    expect(validateCompletionEligibility(draft())).toEqual({
      valid: false,
      issues: [{ field: 'completion', code: 'summary_or_item_required' }],
    });

    expect(validateServiceRecordDraft({
      ...validDraft,
      nextServiceDueDate: '2026-07-22',
      nextServiceDueOdometer: 42_000,
    })).toEqual({
      valid: false,
      issues: [
        { field: 'nextServiceDueDate', code: 'must_be_after_service_date' },
        { field: 'nextServiceDueOdometer', code: 'must_be_greater_than_odometer' },
      ],
    });
  });

  it('applies earlier and later chronological odometer bounds but ignores same-date history', () => {
    const history = [
      draft({ id: 'earlier', status: 'completed', serviceDate: '2026-07-01', odometer: 40_000, displayNumber: 'SR-000001', completedAt: '2026-07-01T00:00:00.000Z' }),
      draft({ id: 'same-date', status: 'completed', serviceDate: '2026-07-22', odometer: 9_999, displayNumber: 'SR-000002', completedAt: '2026-07-22T00:00:00.000Z' }),
      draft({ id: 'later', status: 'completed', serviceDate: '2026-08-01', odometer: 45_000, displayNumber: 'SR-000003', completedAt: '2026-08-01T00:00:00.000Z' }),
    ];

    expect(validateOdometerChronology('2026-07-22', 40_000, history)).toEqual({ valid: true });
    expect(validateOdometerChronology('2026-07-22', 45_000, history)).toEqual({ valid: true });
    expect(validateOdometerChronology('2026-07-22', 39_999, history)).toEqual({
      valid: false,
      issue: { code: 'below_earlier_bound', bound: 40_000 },
    });
    expect(validateOdometerChronology('2026-07-22', 45_001, history)).toEqual({
      valid: false,
      issue: { code: 'above_later_bound', bound: 45_000 },
    });
  });

  it('advances vehicle odometers without reducing them', () => {
    expect(advanceVehicleOdometer(undefined, 42_000)).toBe(42_000);
    expect(advanceVehicleOdometer(40_000, 42_000)).toBe(42_000);
    expect(advanceVehicleOdometer(45_000, 42_000)).toBe(45_000);
  });

  it('creates an ordered immutable completed-record snapshot with derived totals', () => {
    const snapshot = createServiceRecordSnapshot({
      id: 'snapshot-1',
      schemaVersion: 1,
      templateVersion: 1,
      brandingVersion: 1,
      generatedAt: '2026-07-23T00:00:00.000Z',
      createdById: 'owner-1',
      record: draft({
        status: 'completed',
        displayNumber: 'SR-000001',
        completedAt: '2026-07-22T12:00:00.000Z',
        summary: 'Annual service',
        items: [
          { id: 'late', kind: 'part', name: 'Filter', purchaseCostMinor: 1_200, sortOrder: 1 },
          { id: 'first', kind: 'work', name: 'Inspection', sortOrder: 0 },
        ],
      }),
      vehicle: { make: 'Ferrari', model: 'Roma', registration: 'ABC 123', odometerUnit: 'km' },
    });

    expect(snapshot.totalPurchaseCostMinor).toBe(1_200);
    expect(snapshot.items.map((item) => item.id)).toEqual(['first', 'late']);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.items)).toBe(true);
  });
});
