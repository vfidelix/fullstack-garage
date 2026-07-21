import type {
  VehicleDuplicateWarning,
  VehicleRepository,
} from '../../../application/ports/vehicleRepository';
import {
  createVehicleError,
  createVehicleValidationError,
  type VehicleResult,
} from '../../../application/vehicles/vehicleResult';
import {
  findDuplicateVehicle,
  formatVehicleLabel,
  validateCreateVehicle,
  validateUpdateVehicle,
  type CreateVehicle,
  type UpdateVehicle,
  type Vehicle,
  type VehicleDuplicateCandidate,
  type VehicleId,
  type VehicleSummary,
} from '../../../domain/vehicles/vehicle';
import { getSupabaseClient } from '../client';
import { mapSupabaseVehicleError } from './mapVehicleError';
import { mapVehicleRow, mapVehicleSummaryRow } from './mapVehicleRow';

const VEHICLE_COLUMNS = [
  'id',
  'owner_id',
  'make',
  'model',
  'year',
  'registration',
  'registration_state',
  'vin',
  'current_odometer',
  'odometer_unit',
  'engine',
  'notes',
  'archived_at',
  'created_at',
  'updated_at',
].join(',');

const VEHICLE_SUMMARY_COLUMNS = [
  'id',
  'make',
  'model',
  'year',
  'registration',
  'registration_state',
  'current_odometer',
  'odometer_unit',
  'archived_at',
].join(',');

interface VehicleProviderResponse {
  readonly data: unknown;
  readonly error: unknown;
  readonly status?: number;
}

interface VehicleQuery extends PromiseLike<VehicleProviderResponse> {
  select(columns: string): VehicleQuery;
  insert(values: Readonly<Record<string, unknown>>): VehicleQuery;
  update(values: Readonly<Record<string, unknown>>): VehicleQuery;
  delete(): VehicleQuery;
  eq(column: 'id', value: string): VehicleQuery;
  is(column: 'archived_at', value: null): VehicleQuery;
  not(column: 'archived_at', operator: 'is', value: null): VehicleQuery;
  order(
    column: 'created_at' | 'id',
    options: { readonly ascending: boolean },
  ): VehicleQuery;
  maybeSingle(): PromiseLike<VehicleProviderResponse>;
}

export interface VehicleRepositoryClient {
  from(table: 'vehicles'): VehicleQuery;
  rpc(
    functionName: 'archive_vehicle' | 'restore_vehicle',
    parameters: { readonly p_vehicle_id: string },
  ): VehicleQuery;
}

type VehicleWriteRow = Readonly<Record<string, unknown>>;

function success<T>(value: T): VehicleResult<T> {
  return { ok: true, value };
}

function failure<T>(error: unknown): VehicleResult<T> {
  return { ok: false, error: mapSupabaseVehicleError(error) };
}

function malformedFailure<T>(): VehicleResult<T> {
  return {
    ok: false,
    error: createVehicleError('temporary_failure'),
  };
}

function toVehicleWriteRow(input: CreateVehicle): VehicleWriteRow {
  return {
    make: input.make,
    model: input.model,
    year: input.year ?? null,
    registration: input.registration ?? null,
    registration_state: input.registrationState ?? null,
    vin: input.vin ?? null,
    current_odometer: input.currentOdometer ?? null,
    odometer_unit: input.odometerUnit,
    engine: input.engine ?? null,
    notes: input.notes ?? null,
  };
}

function withStatus(error: unknown, status: number | undefined): unknown {
  const code = typeof error === 'object'
    && error !== null
    && 'code' in error
    && typeof error.code === 'string'
    ? error.code
    : undefined;

  return { code, status };
}

export class SupabaseVehicleRepository implements VehicleRepository {
  public constructor(
    private readonly client: VehicleRepositoryClient = (
      getSupabaseClient() as unknown as VehicleRepositoryClient
    ),
  ) {}

  public listActive(): Promise<VehicleResult<readonly VehicleSummary[]>> {
    return this.listByLifecycle('active');
  }

  public listArchived(): Promise<VehicleResult<readonly VehicleSummary[]>> {
    return this.listByLifecycle('archived');
  }

  public async getById(id: VehicleId): Promise<VehicleResult<Vehicle>> {
    try {
      const response = await this.client
        .from('vehicles')
        .select(VEHICLE_COLUMNS)
        .eq('id', id)
        .maybeSingle();

      return this.mapSingleVehicleResponse(response);
    } catch (error: unknown) {
      return failure(error);
    }
  }

  public async create(input: CreateVehicle): Promise<VehicleResult<Vehicle>> {
    const validation = validateCreateVehicle(input);

    if (!validation.valid) {
      return {
        ok: false,
        error: createVehicleValidationError(validation.issues),
      };
    }

    try {
      const response = await this.client
        .from('vehicles')
        .insert(toVehicleWriteRow(validation.value))
        .select(VEHICLE_COLUMNS)
        .maybeSingle();

      return this.mapSingleVehicleResponse(response);
    } catch (error: unknown) {
      return failure(error);
    }
  }

  public async update(
    id: VehicleId,
    input: UpdateVehicle,
  ): Promise<VehicleResult<Vehicle>> {
    const validation = validateUpdateVehicle(input);

    if (!validation.valid) {
      return {
        ok: false,
        error: createVehicleValidationError(validation.issues),
      };
    }

    try {
      const response = await this.client
        .from('vehicles')
        .update(toVehicleWriteRow(validation.value))
        .eq('id', id)
        .select(VEHICLE_COLUMNS)
        .maybeSingle();

      return this.mapSingleVehicleResponse(response);
    } catch (error: unknown) {
      return failure(error);
    }
  }

  public archive(id: VehicleId): Promise<VehicleResult<Vehicle>> {
    return this.changeLifecycle('archive_vehicle', id, 'archived');
  }

  public restore(id: VehicleId): Promise<VehicleResult<Vehicle>> {
    return this.changeLifecycle('restore_vehicle', id, 'active');
  }

  public async delete(id: VehicleId): Promise<VehicleResult<void>> {
    try {
      const response = await this.client
        .from('vehicles')
        .delete()
        .eq('id', id)
        .select('id')
        .maybeSingle();

      if (response.error !== null) {
        return failure(withStatus(response.error, response.status));
      }

      if (
        typeof response.data !== 'object'
        || response.data === null
        || Array.isArray(response.data)
        || !('id' in response.data)
        || response.data.id !== id
      ) {
        return response.data === null
          ? failure({ code: 'P0002' })
          : malformedFailure();
      }

      return success(undefined);
    } catch (error: unknown) {
      return failure(error);
    }
  }

  public async findDuplicate(
    candidate: VehicleDuplicateCandidate,
    excludeVehicleId?: VehicleId,
  ): Promise<VehicleResult<VehicleDuplicateWarning | undefined>> {
    try {
      const response = await this.orderedSummaryQuery();

      if (response.error !== null) {
        return failure(withStatus(response.error, response.status));
      }

      const vehicles = this.mapSummaryRows(response.data);

      if (vehicles === null) {
        return malformedFailure();
      }

      const duplicate = findDuplicateVehicle(
        vehicles,
        candidate,
        excludeVehicleId,
      );

      return success(duplicate === undefined
        ? undefined
        : {
            vehicleId: duplicate.id,
            label: formatVehicleLabel(duplicate),
          });
    } catch (error: unknown) {
      return failure(error);
    }
  }

  private async listByLifecycle(
    lifecycle: 'active' | 'archived',
  ): Promise<VehicleResult<readonly VehicleSummary[]>> {
    try {
      const baseQuery = this.client
        .from('vehicles')
        .select(VEHICLE_SUMMARY_COLUMNS);
      const lifecycleQuery = lifecycle === 'active'
        ? baseQuery.is('archived_at', null)
        : baseQuery.not('archived_at', 'is', null);
      const response = await lifecycleQuery
        .order('created_at', { ascending: false })
        .order('id', { ascending: true });

      if (response.error !== null) {
        return failure(withStatus(response.error, response.status));
      }

      const vehicles = this.mapSummaryRows(response.data);

      if (
        vehicles === null
        || vehicles.some((vehicle) => (
          lifecycle === 'active'
            ? vehicle.archivedAt !== undefined
            : vehicle.archivedAt === undefined
        ))
      ) {
        return malformedFailure();
      }

      return success(vehicles);
    } catch (error: unknown) {
      return failure(error);
    }
  }

  private orderedSummaryQuery(): VehicleQuery {
    return this.client
      .from('vehicles')
      .select(VEHICLE_SUMMARY_COLUMNS)
      .order('created_at', { ascending: false })
      .order('id', { ascending: true });
  }

  private async changeLifecycle(
    operation: 'archive_vehicle' | 'restore_vehicle',
    id: VehicleId,
    expectedLifecycle: 'active' | 'archived',
  ): Promise<VehicleResult<Vehicle>> {
    try {
      const response = await this.client
        .rpc(operation, { p_vehicle_id: id })
        .select(VEHICLE_COLUMNS)
        .maybeSingle();
      const result = this.mapSingleVehicleResponse(response);

      if (!result.ok) {
        return result;
      }

      const isArchived = result.value.archivedAt !== undefined;

      if (
        (expectedLifecycle === 'archived' && !isArchived)
        || (expectedLifecycle === 'active' && isArchived)
      ) {
        return malformedFailure();
      }

      return result;
    } catch (error: unknown) {
      return failure(error);
    }
  }

  private mapSingleVehicleResponse(
    response: VehicleProviderResponse,
  ): VehicleResult<Vehicle> {
    if (response.error !== null) {
      return failure(withStatus(response.error, response.status));
    }

    if (response.data === null) {
      return failure({ code: 'P0002' });
    }

    const vehicle = mapVehicleRow(response.data);
    return vehicle === null ? malformedFailure() : success(vehicle);
  }

  private mapSummaryRows(data: unknown): readonly VehicleSummary[] | null {
    if (!Array.isArray(data)) {
      return null;
    }

    const vehicles: VehicleSummary[] = [];

    for (const row of data) {
      const vehicle = mapVehicleSummaryRow(row);

      if (vehicle === null) {
        return null;
      }

      vehicles.push(vehicle);
    }

    return vehicles;
  }
}
