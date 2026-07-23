import {
  describeServiceRecordRepositoryContract,
  type ServiceRecordRepositoryContractHarness,
  type ServiceRecordRepositoryContractScenario,
} from '../../../application/ports/serviceRecordRepository.contract';
import type { ServiceRecordSnapshot } from '../../../domain/service-records/serviceRecord';
import type { ServiceRecordRepositoryClient } from './SupabaseServiceRecordRepository';
import { SupabaseServiceRecordRepository } from './SupabaseServiceRecordRepository';
import { SupabaseServiceRecordSnapshotRepository } from './SupabaseServiceRecordSnapshotRepository';

type Query = ReturnType<ServiceRecordRepositoryClient['from']>;
type Response = Awaited<Query>;
type Row = Record<string, unknown>;

const ownerId = '71000000-0000-4000-8000-000000000001';
const vehicleId = '72000000-0000-4000-8000-000000000001';
const recordId = '73000000-0000-4000-8000-000000000001';
const firstItemId = '74000000-0000-4000-8000-000000000001';
const secondItemId = '74000000-0000-4000-8000-000000000002';
const snapshotId = '75000000-0000-4000-8000-000000000001';
const timestamp = '2026-07-22T00:00:00.000Z';

class QueryHarness implements Query {
  public constructor(
    private readonly resolve: (single: boolean) => Response,
  ) {}

  public select(columns: string): Query {
    void columns;
    return this;
  }

  public eq(column: string, value: string): Query {
    void column;
    void value;
    return this;
  }

  public order(column: string, options: { readonly ascending: boolean }): Query {
    void column;
    void options;
    return this;
  }

  public maybeSingle(): PromiseLike<Response> {
    return Promise.resolve(this.resolve(true));
  }

  public then<TResult1 = Response, TResult2 = never>(
    onfulfilled?: ((value: Response) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.resolve(false)).then(onfulfilled, onrejected);
  }
}

class ClientHarness implements ServiceRecordRepositoryClient {
  private record: Row | null;
  private readonly exports: Row[] = [];

  public constructor(private readonly scenario: ServiceRecordRepositoryContractScenario) {
    this.record = scenario.vehicle === 'archived' ? this.completedRecord() : null;
  }

  public from(table: 'service_records' | 'service_record_exports'): Query {
    return new QueryHarness((single) => this.read(table, single));
  }

  public rpc(functionName: string, parameters: Readonly<Record<string, unknown>>): Query {
    return new QueryHarness(() => this.write(functionName, parameters));
  }

  private read(table: 'service_records' | 'service_record_exports', single: boolean): Response {
    const denied = this.denied();
    if (denied !== null) {
      return denied;
    }

    if (table === 'service_records') {
      return { data: single ? this.record : this.record === null ? [] : [this.record], error: null };
    }

    return { data: single ? this.exports[0] ?? null : this.exports, error: null };
  }

  private write(functionName: string, parameters: Readonly<Record<string, unknown>>): Response {
    const denied = this.denied();
    if (denied !== null) {
      return denied;
    }

    switch (functionName) {
      case 'create_service_record_draft':
        if (this.scenario.vehicle === 'archived') {
          return this.error('55000');
        }
        this.record = this.draftRecord(
          parameters.p_service_date,
          parameters.p_odometer,
        );
        return this.success(this.record);
      case 'save_service_record_draft':
        return this.save(parameters);
      case 'delete_service_record_draft':
        return this.remove(parameters);
      case 'complete_service_record':
        return this.complete(parameters);
      case 'create_service_record_export':
        return this.saveExport(parameters);
      default:
        return this.error('P0002');
    }
  }

  private save(parameters: Readonly<Record<string, unknown>>): Response {
    if (this.record === null) {
      return this.error('P0002');
    }
    if (this.record.status !== 'draft') {
      return this.error('55000');
    }
    if (parameters.p_expected_version !== this.record.version) {
      return this.error('40001');
    }
    const draft = parameters.p_draft as Row;
    const items = Array.isArray(draft.items) ? draft.items : [];
    this.record = {
      ...this.record,
      service_date: draft.serviceDate,
      odometer: draft.odometer,
      summary: draft.summary ?? null,
      service_record_items: items.map((item) => this.itemRow(item as Row)),
      version: (this.record.version as number) + 1,
      updated_at: timestamp,
    };
    return this.success(this.record);
  }

  private remove(parameters: Readonly<Record<string, unknown>>): Response {
    if (this.record === null) {
      return this.error('P0002');
    }
    if (this.record.status !== 'draft') {
      return this.error('55000');
    }
    if (parameters.p_expected_version !== this.record.version) {
      return this.error('40001');
    }
    this.record = null;
    return this.success(null);
  }

  private complete(parameters: Readonly<Record<string, unknown>>): Response {
    if (this.record === null) {
      return this.error('P0002');
    }
    const expectedVersion = parameters.p_expected_version;
    if (this.record.status === 'completed') {
      return expectedVersion === this.record.version || expectedVersion === (this.record.version as number) - 1
        ? this.success(this.record)
        : this.error('40001');
    }
    if (expectedVersion !== this.record.version) {
      return this.error('40001');
    }
    this.record = {
      ...this.record,
      display_number: 'SR-000001',
      status: 'completed',
      version: (this.record.version as number) + 1,
      completed_at: timestamp,
    };
    return this.success(this.record);
  }

  private saveExport(parameters: Readonly<Record<string, unknown>>): Response {
    const exportPayload = parameters.p_export as Row;
    if (this.record?.status !== 'completed') {
      return this.error('P0002');
    }
    const row: Row = {
      id: exportPayload.id,
      service_record_id: exportPayload.serviceRecordId,
      service_record_version: exportPayload.serviceRecordVersion,
      snapshot: exportPayload.snapshot,
      schema_version: exportPayload.schemaVersion,
      template_version: exportPayload.templateVersion,
      branding_version: exportPayload.brandingVersion,
      created_at: timestamp,
    };
    this.exports.unshift(row);
    return this.success(row);
  }

  private draftRecord(serviceDate: unknown, odometer: unknown): Row {
    return {
      id: recordId,
      owner_id: ownerId,
      vehicle_id: vehicleId,
      display_number: null,
      status: 'draft',
      service_date: serviceDate,
      odometer,
      performed_by: null,
      location: null,
      summary: null,
      notes: null,
      next_service_due_date: null,
      next_service_due_odometer: null,
      currency_code: 'AUD',
      version: 1,
      created_at: timestamp,
      updated_at: timestamp,
      completed_at: null,
      service_record_items: [],
    };
  }

  private completedRecord(): Row {
    const record = this.draftRecord('2026-07-22', 12_500);
    return {
      ...record,
      display_number: 'SR-000001',
      status: 'completed',
      summary: 'Completed history',
      version: 3,
      completed_at: timestamp,
      service_record_items: [
        this.itemRow({
          id: firstItemId,
          kind: 'part',
          name: 'Oil filter',
          purchaseCostMinor: 6_500,
          sortOrder: 0,
        }),
      ],
    };
  }

  private itemRow(item: Row): Row {
    return {
      id: item.id,
      kind: item.kind,
      category: item.category ?? null,
      name: item.name,
      brand: item.brand ?? null,
      specification: item.specification ?? null,
      part_number: item.partNumber ?? null,
      supplier: item.supplier ?? null,
      quantity: item.quantity ?? null,
      unit: item.unit ?? null,
      purchase_cost_minor: item.purchaseCostMinor ?? null,
      notes: item.notes ?? null,
      sort_order: item.sortOrder,
    };
  }

  private denied(): Response | null {
    return this.scenario.access === 'denied'
      ? this.error('42501')
      : null;
  }

  private success(data: unknown): Response {
    return { data, error: null };
  }

  private error(code: string): Response {
    return { data: null, error: { code, message: 'Synthetic private provider detail' } };
  }
}

function createHarness(
  scenario: ServiceRecordRepositoryContractScenario = {},
): ServiceRecordRepositoryContractHarness {
  const client = new ClientHarness(scenario);
  const snapshot: ServiceRecordSnapshot = {
    id: snapshotId,
    schemaVersion: 1,
    templateVersion: 1,
    brandingVersion: 1,
    serviceRecordId: recordId,
    displayNumber: 'SR-000001',
    status: 'completed',
    serviceRecordVersion: 3,
    serviceDate: '2026-07-22',
    generatedAt: timestamp,
    createdById: ownerId,
    vehicle: { make: 'Ferrari', model: 'Roma', odometerUnit: 'km' },
    odometer: 12_500,
    currencyCode: 'AUD',
    items: [{
      id: firstItemId,
      kind: 'part',
      name: 'Oil filter',
      purchaseCostMinor: 6_500,
      sortOrder: 0,
    }],
    totalPurchaseCostMinor: 6_500,
  };

  return {
    fixtures: {
      vehicleId,
      recordId,
      createDraft: { vehicleId, serviceDate: '2026-07-22', odometer: 12_500 },
      completeDraft: {
        serviceDate: '2026-07-22',
        odometer: 12_500,
        summary: 'Annual service',
        items: [
          {
            id: secondItemId,
            kind: 'part',
            name: 'Engine oil',
            purchaseCostMinor: 4_000,
            sortOrder: 1,
          },
          {
            id: firstItemId,
            kind: 'part',
            name: 'Oil filter',
            purchaseCostMinor: 2_500,
            sortOrder: 0,
          },
        ],
      },
      snapshot,
    },
    records: new SupabaseServiceRecordRepository(client),
    snapshots: new SupabaseServiceRecordSnapshotRepository(client),
  };
}

describeServiceRecordRepositoryContract(
  'SupabaseServiceRecordRepository',
  createHarness,
);
