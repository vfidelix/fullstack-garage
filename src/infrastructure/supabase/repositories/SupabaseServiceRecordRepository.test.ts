/* eslint-disable @stylistic/max-statements-per-line -- Test fixtures are intentionally compact to expose provider row shape. */
import { describe, expect, it } from 'vitest';
import type { ServiceRecordRepositoryClient } from './SupabaseServiceRecordRepository';
import { SupabaseServiceRecordRepository } from './SupabaseServiceRecordRepository';
import { mapSupabaseServiceRecordError } from './mapServiceRecordError';

type Query = ReturnType<ServiceRecordRepositoryClient['from']>;
type Response = Awaited<Query>;
type Outcome = { readonly response: Response } | { readonly rejection: Error };

class QueryHarness implements Query {
  public constructor(private readonly outcome: Outcome, private readonly calls: { method: string; arguments: readonly unknown[] }[]) {}
  public select(columns: string): Query { return this.record('select', columns); }
  public eq(column: string, value: string): Query { return this.record('eq', column, value); }
  public order(column: string, options: { readonly ascending: boolean }): Query { return this.record('order', column, options); }
  public maybeSingle(): PromiseLike<Response> { this.calls.push({ method: 'maybeSingle', arguments: [] }); return this.promise(); }
  public then<TResult1 = Response, TResult2 = never>(onfulfilled?: ((value: Response) => TResult1 | PromiseLike<TResult1>) | null, onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null): PromiseLike<TResult1 | TResult2> { return this.promise().then(onfulfilled, onrejected); }
  private record(method: string, ...arguments_: readonly unknown[]): Query { this.calls.push({ method, arguments: arguments_ }); return this; }
  private promise(): Promise<Response> { return 'response' in this.outcome ? Promise.resolve(this.outcome.response) : Promise.reject(this.outcome.rejection); }
}

class ClientHarness implements ServiceRecordRepositoryClient {
  public readonly calls: { method: string; arguments: readonly unknown[] }[] = [];
  public constructor(private readonly outcomes: Outcome[]) {}
  public from(table: 'service_records' | 'service_record_exports'): Query { this.calls.push({ method: 'from', arguments: [table] }); return new QueryHarness(this.next(), this.calls); }
  public rpc(functionName: string, parameters: Readonly<Record<string, unknown>>): Query { this.calls.push({ method: 'rpc', arguments: [functionName, parameters] }); return new QueryHarness(this.next(), this.calls); }
  private next(): Outcome { const outcome = this.outcomes.shift(); if (outcome === undefined) throw new Error('No queued response'); return outcome; }
}

const recordId = '10000000-0000-4000-8000-000000000001';
const ownerId = '20000000-0000-4000-8000-000000000001';
const vehicleId = '30000000-0000-4000-8000-000000000001';
const itemId = '40000000-0000-4000-8000-000000000001';
const snapshotId = '50000000-0000-4000-8000-000000000001';
const recordRow = { id: recordId, owner_id: ownerId, vehicle_id: vehicleId, display_number: null, status: 'draft', service_date: '2026-07-22', odometer: 12500, performed_by: null, location: null, summary: 'Oil service', notes: null, next_service_due_date: null, next_service_due_odometer: null, currency_code: 'AUD', version: 1, created_at: '2026-07-22T00:00:00.000Z', updated_at: '2026-07-22T00:00:00.000Z', completed_at: null, service_record_items: [{ id: itemId, kind: 'part', category: null, name: 'Oil filter', brand: null, specification: null, part_number: null, supplier: null, quantity: 1, unit: null, purchase_cost_minor: 2500, notes: null, sort_order: 0 }] };
const snapshot = { id: snapshotId, schemaVersion: 1, templateVersion: 1, brandingVersion: 1, serviceRecordId: recordId, displayNumber: 'SR-000001', status: 'completed' as const, serviceRecordVersion: 2, serviceDate: '2026-07-22', generatedAt: '2026-07-22T00:00:00.000Z', createdById: ownerId, vehicle: { make: 'Ferrari', model: 'Roma', odometerUnit: 'km' as const }, odometer: 12500, currencyCode: 'AUD' as const, items: [], totalPurchaseCostMinor: 0 };
const exportRow = { id: snapshotId, service_record_id: recordId, service_record_version: 2, snapshot, schema_version: 1, template_version: 1, branding_version: 1, created_at: snapshot.generatedAt };
const response = (data: unknown, error: unknown = null, status = 200): Outcome => ({ response: { data, error, status } });

describe('SupabaseServiceRecordRepository', () => {
  it('reads only required aggregate fields and strictly maps ordered items', async () => {
    const client = new ClientHarness([response(recordRow)]);
    const repository = new SupabaseServiceRecordRepository(client);
    await expect(repository.getById(recordId)).resolves.toMatchObject({ ok: true, value: { id: recordId, items: [{ id: itemId, sortOrder: 0 }] } });
    expect(client.calls).toContainEqual({ method: 'from', arguments: ['service_records'] });
    expect(client.calls).toContainEqual(expect.objectContaining({ method: 'select', arguments: [expect.stringContaining('service_record_items')] }));
  });

  it('uses only RPC writes and does not forward protected record fields', async () => {
    const client = new ClientHarness([response({ id: recordId }), response(recordRow), response({ id: recordId }), response(recordRow), response(null)]);
    const repository = new SupabaseServiceRecordRepository(client);
    await repository.createDraft({ vehicleId, serviceDate: '2026-07-22', odometer: 12500 });
    await repository.saveDraft({ id: recordId, expectedVersion: 1, draft: { serviceDate: '2026-07-22', odometer: 12500, summary: 'Oil service', items: [] } });
    await repository.deleteDraft(recordId, 1);
    expect(client.calls.filter((call) => call.method === 'rpc')).toEqual([
      { method: 'rpc', arguments: ['create_service_record_draft', { p_vehicle_id: vehicleId, p_service_date: '2026-07-22', p_odometer: 12500 }] },
      expect.objectContaining({ method: 'rpc', arguments: ['save_service_record_draft', expect.objectContaining({ p_record_id: recordId, p_expected_version: 1 })] }),
      { method: 'rpc', arguments: ['delete_service_record_draft', { p_record_id: recordId, p_expected_version: 1 }] },
    ]);
    const save = client.calls.find((call) => call.method === 'rpc' && call.arguments[0] === 'save_service_record_draft');
    expect(save?.arguments[1]).not.toHaveProperty('owner_id');
    expect(client.calls.filter((call) => call.method === 'from' && call.arguments[0] === 'service_records')).toHaveLength(2);
  });

  it('maps malformed rows and provider conflicts to app-owned errors', async () => {
    const client = new ClientHarness([response({ ...recordRow, status: 'wrong' }), response(null, { code: '40001' })]);
    const repository = new SupabaseServiceRecordRepository(client);
    await expect(repository.getById(recordId)).resolves.toMatchObject({ ok: false, error: { category: 'temporary_failure' } });
    await expect(repository.complete(recordId, 1)).resolves.toMatchObject({ ok: false, error: { category: 'version_conflict' } });
    expect(mapSupabaseServiceRecordError({ code: '22023' })).toMatchObject({ category: 'validation' });
    expect(mapSupabaseServiceRecordError({ code: '42501' })).toMatchObject({ category: 'unauthorized' });
  });
});

describe('SupabaseServiceRecordSnapshotRepository', () => {
  it('persists snapshots only through the export RPC and rejects malformed snapshot JSON', async () => {
    const { SupabaseServiceRecordSnapshotRepository } = await import('./SupabaseServiceRecordSnapshotRepository');
    const client = new ClientHarness([response(exportRow), response({ ...exportRow, snapshot: {} })]);
    const repository = new SupabaseServiceRecordSnapshotRepository(client);
    await expect(repository.save(snapshot)).resolves.toMatchObject({ ok: true, value: snapshot });
    await expect(repository.getById(snapshotId)).resolves.toMatchObject({ ok: false, error: { category: 'temporary_failure' } });
    expect(client.calls[0]).toEqual(expect.objectContaining({ method: 'rpc', arguments: ['create_service_record_export', expect.any(Object)] }));
  });
});
