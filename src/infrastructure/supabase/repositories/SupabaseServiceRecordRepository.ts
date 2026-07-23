/* eslint-disable @stylistic/max-statements-per-line -- Provider boundary keeps RPC payloads and guard clauses compact. */
import type { ServiceRecordRepository, ServiceRecordSummary } from '../../../application/ports/serviceRecordRepository';
import type { ServiceRecordResult } from '../../../application/service-records/serviceRecordResult';
import type { ServiceRecord, ServiceRecordDraftInput, ServiceRecordId } from '../../../domain/service-records/serviceRecord';
import type { VehicleId } from '../../../domain/vehicles/vehicle';
import { getSupabaseClient } from '../client';
import { mapSupabaseServiceRecordError } from './mapServiceRecordError';
import { mapServiceRecordRow, mapServiceRecordSummaryRow } from './mapServiceRecordRow';

const RECORD_COLUMNS = 'id,owner_id,vehicle_id,display_number,status,service_date,odometer,performed_by,location,summary,notes,next_service_due_date,next_service_due_odometer,currency_code,version,created_at,updated_at,completed_at,service_record_items(id,kind,category,name,brand,specification,part_number,supplier,quantity,unit,purchase_cost_minor,notes,sort_order)';
const SUMMARY_COLUMNS = 'id,vehicle_id,display_number,status,service_date,odometer,summary,currency_code,version,completed_at,service_record_items(purchase_cost_minor)';

interface Response { readonly data: unknown; readonly error: unknown; readonly status?: number }
export interface ServiceRecordQuery extends PromiseLike<Response> {
  select(columns: string): ServiceRecordQuery;
  eq(column: string, value: string): ServiceRecordQuery;
  order(column: string, options: { readonly ascending: boolean }): ServiceRecordQuery;
  maybeSingle(): PromiseLike<Response>;
}
export interface ServiceRecordRepositoryClient {
  from(table: 'service_records' | 'service_record_exports'): ServiceRecordQuery;
  rpc(functionName: string, parameters: Readonly<Record<string, unknown>>): ServiceRecordQuery;
}

const success = <T>(value: T): ServiceRecordResult<T> => ({ ok: true, value });
const failure = <T>(error: unknown): ServiceRecordResult<T> => ({ ok: false, error: mapSupabaseServiceRecordError(error) });
const malformed = <T>(): ServiceRecordResult<T> => failure({ code: 'malformed_provider_response' });
const statusError = (error: unknown, status: number | undefined): unknown => ({ ...(typeof error === 'object' && error !== null ? error : {}), status });
const isRecordIdRow = (value: unknown): value is { readonly id: ServiceRecordId } => (
  typeof value === 'object'
  && value !== null
  && !Array.isArray(value)
  && typeof (value as { readonly id?: unknown }).id === 'string'
);

function draftJson(draft: ServiceRecordDraftInput): Readonly<Record<string, unknown>> {
  return { serviceDate: draft.serviceDate, odometer: draft.odometer, ...(draft.performedBy === undefined ? {} : { performedBy: draft.performedBy }), ...(draft.location === undefined ? {} : { location: draft.location }), ...(draft.summary === undefined ? {} : { summary: draft.summary }), ...(draft.notes === undefined ? {} : { notes: draft.notes }), ...(draft.nextServiceDueDate === undefined ? {} : { nextServiceDueDate: draft.nextServiceDueDate }), ...(draft.nextServiceDueOdometer === undefined ? {} : { nextServiceDueOdometer: draft.nextServiceDueOdometer }), items: draft.items.map((item) => ({ id: item.id, kind: item.kind, name: item.name, sortOrder: item.sortOrder, ...(item.category === undefined ? {} : { category: item.category }), ...(item.brand === undefined ? {} : { brand: item.brand }), ...(item.specification === undefined ? {} : { specification: item.specification }), ...(item.partNumber === undefined ? {} : { partNumber: item.partNumber }), ...(item.supplier === undefined ? {} : { supplier: item.supplier }), ...(item.quantity === undefined ? {} : { quantity: item.quantity }), ...(item.unit === undefined ? {} : { unit: item.unit }), ...(item.purchaseCostMinor === undefined ? {} : { purchaseCostMinor: item.purchaseCostMinor }), ...(item.notes === undefined ? {} : { notes: item.notes }) })) };
}

export class SupabaseServiceRecordRepository implements ServiceRecordRepository {
  public constructor(private readonly client: ServiceRecordRepositoryClient = getSupabaseClient() as unknown as ServiceRecordRepositoryClient) {}
  public async getById(id: ServiceRecordId): Promise<ServiceRecordResult<ServiceRecord | null>> {
    try { const response = await this.client.from('service_records').select(RECORD_COLUMNS).eq('id', id).maybeSingle(); if (response.error !== null) return failure(statusError(response.error, response.status)); if (response.data === null) return success(null); const record = mapServiceRecordRow(response.data); return record === null ? malformed() : success(record); } catch (error: unknown) { return failure(error); }
  }

  public async listForVehicle(vehicleId: VehicleId): Promise<ServiceRecordResult<readonly ServiceRecordSummary[]>> {
    try { const response = await this.client.from('service_records').select(SUMMARY_COLUMNS).eq('vehicle_id', vehicleId).order('service_date', { ascending: false }).order('id', { ascending: true }); if (response.error !== null) return failure(statusError(response.error, response.status)); if (!Array.isArray(response.data)) return malformed(); const records = response.data.map(mapServiceRecordSummaryRow); return records.some((record) => record === null) ? malformed() : success(records as ServiceRecordSummary[]); } catch (error: unknown) { return failure(error); }
  }

  public async createDraft(input: { readonly vehicleId: VehicleId; readonly serviceDate: string; readonly odometer: number }): Promise<ServiceRecordResult<ServiceRecord>> { return this.recordRpc('create_service_record_draft', { p_vehicle_id: input.vehicleId, p_service_date: input.serviceDate, p_odometer: input.odometer }); }
  public async saveDraft(input: { readonly id: ServiceRecordId; readonly expectedVersion: number; readonly draft: ServiceRecordDraftInput }): Promise<ServiceRecordResult<ServiceRecord>> { return this.recordRpc('save_service_record_draft', { p_record_id: input.id, p_expected_version: input.expectedVersion, p_draft: draftJson(input.draft) }); }
  public async deleteDraft(id: ServiceRecordId, expectedVersion: number): Promise<ServiceRecordResult<void>> { try { const response = await this.client.rpc('delete_service_record_draft', { p_record_id: id, p_expected_version: expectedVersion }); return response.error === null ? success(undefined) : failure(statusError(response.error, response.status)); } catch (error: unknown) { return failure(error); } }
  public async complete(id: ServiceRecordId, expectedVersion: number): Promise<ServiceRecordResult<ServiceRecord>> { return this.recordRpc('complete_service_record', { p_record_id: id, p_expected_version: expectedVersion }); }
  private async recordRpc(name: string, parameters: Readonly<Record<string, unknown>>): Promise<ServiceRecordResult<ServiceRecord>> {
    try {
      const response = await this.client.rpc(name, parameters).select('id').maybeSingle();
      if (response.error !== null) return failure(statusError(response.error, response.status));
      if (!isRecordIdRow(response.data)) return malformed();
      const record = await this.getById(response.data.id);
      if (!record.ok) return record;
      return record.value === null ? malformed() : success(record.value);
    } catch (error: unknown) {
      return failure(error);
    }
  }
}
