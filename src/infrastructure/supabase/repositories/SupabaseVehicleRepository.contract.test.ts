import {
  describeVehicleRepositoryContract,
  type VehicleRepositoryContractHarness,
  type VehicleRepositoryContractOperation,
  type VehicleRepositoryContractScenario,
} from '../../../application/ports/vehicleRepository.contract';
import type { Vehicle } from '../../../domain/vehicles/vehicle';
import type { VehicleRepositoryClient } from './SupabaseVehicleRepository';
import { SupabaseVehicleRepository } from './SupabaseVehicleRepository';

type HarnessQuery = ReturnType<VehicleRepositoryClient['from']>;
type HarnessResponse = Awaited<HarnessQuery>;

type VehicleRow = Readonly<Record<string, unknown>> & {
  readonly id: string;
  readonly archived_at: string | null;
  readonly created_at: string;
};

const activeVehicleId = '31000000-0000-4000-8000-000000000001';
const archivedVehicleId = '31000000-0000-4000-8000-000000000002';
const createdVehicleId = '31000000-0000-4000-8000-000000000003';
const garageAdminId = '32000000-0000-4000-8000-000000000001';

const activeRow: VehicleRow = {
  id: activeVehicleId,
  owner_id: garageAdminId,
  make: 'Ferrari',
  model: 'Roma',
  year: '2018-2021',
  registration: 'TEST 123',
  registration_state: 'WA',
  vin: 'SYNTHETIC-VIN-ACTIVE',
  current_odometer: 12_500,
  odometer_unit: 'km',
  engine: 'Synthetic engine A',
  body: 'Coupe',
  notes: 'Synthetic private Vehicle notes A',
  archived_at: null,
  created_at: '2026-07-20T01:00:00.000Z',
  updated_at: '2026-07-20T01:00:00.000Z',
};

const archivedRow: VehicleRow = {
  ...activeRow,
  id: archivedVehicleId,
  vin: 'SYNTHETIC-VIN-ARCHIVED',
  notes: 'Synthetic private Vehicle notes B',
  archived_at: '2026-07-20T03:00:00.000Z',
  created_at: '2026-07-20T02:00:00.000Z',
  updated_at: '2026-07-20T03:00:00.000Z',
};

const activeVehicle: Vehicle = {
  id: activeVehicleId,
  ownerId: garageAdminId,
  make: 'Ferrari',
  model: 'Roma',
  year: '2018-2021',
  registration: 'TEST 123',
  registrationState: 'WA',
  vin: 'SYNTHETIC-VIN-ACTIVE',
  currentOdometer: 12_500,
  odometerUnit: 'km',
  engine: 'Synthetic engine A',
  body: 'Coupe',
  notes: 'Synthetic private Vehicle notes A',
  createdAt: '2026-07-20T01:00:00.000Z',
  updatedAt: '2026-07-20T01:00:00.000Z',
};

const archivedDuplicateVehicle: Vehicle = {
  ...activeVehicle,
  id: archivedVehicleId,
  vin: 'SYNTHETIC-VIN-ARCHIVED',
  notes: 'Synthetic private Vehicle notes B',
  archivedAt: '2026-07-20T03:00:00.000Z',
  createdAt: '2026-07-20T02:00:00.000Z',
  updatedAt: '2026-07-20T03:00:00.000Z',
};

interface QueryState {
  readonly source: 'table' | 'rpc';
  readonly rpcOperation?: 'archive_vehicle' | 'restore_vehicle';
  readonly rpcVehicleId?: string;
  action?: 'select' | 'insert' | 'update' | 'delete';
  id?: string;
  lifecycle?: 'active' | 'archived';
  values?: Readonly<Record<string, unknown>>;
}

class QueryHarness implements HarnessQuery {
  public constructor(
    private readonly client: ClientHarness,
    private readonly state: QueryState,
  ) {}

  public select(columns: string): HarnessQuery {
    void columns;
    this.state.action ??= 'select';
    return this;
  }

  public insert(values: Readonly<Record<string, unknown>>): HarnessQuery {
    this.state.action = 'insert';
    this.state.values = values;
    return this;
  }

  public update(values: Readonly<Record<string, unknown>>): HarnessQuery {
    this.state.action = 'update';
    this.state.values = values;
    return this;
  }

  public delete(): HarnessQuery {
    this.state.action = 'delete';
    return this;
  }

  public eq(_column: 'id', value: string): HarnessQuery {
    this.state.id = value;
    return this;
  }

  public is(column: 'archived_at', value: null): HarnessQuery {
    void column;
    void value;
    this.state.lifecycle = 'active';
    return this;
  }

  public not(
    column: 'archived_at',
    operator: 'is',
    value: null,
  ): HarnessQuery {
    void column;
    void operator;
    void value;
    this.state.lifecycle = 'archived';
    return this;
  }

  public order(
    column: 'created_at' | 'id',
    options: { readonly ascending: boolean },
  ): HarnessQuery {
    void column;
    void options;
    return this;
  }

  public maybeSingle(): PromiseLike<HarnessResponse> {
    return this.client.resolve(this.state, true);
  }

  public then<TResult1 = HarnessResponse, TResult2 = never>(
    onfulfilled?: ((value: HarnessResponse) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.client.resolve(this.state, false).then(onfulfilled, onrejected);
  }
}

class ClientHarness implements VehicleRepositoryClient {
  private readonly rows: VehicleRow[];

  public constructor(private readonly scenario: VehicleRepositoryContractScenario) {
    this.rows = scenario.empty === true ? [] : [activeRow, archivedRow];
  }

  public from(table: 'vehicles'): HarnessQuery {
    void table;
    return new QueryHarness(this, { source: 'table' });
  }

  public rpc(
    functionName: 'archive_vehicle' | 'restore_vehicle',
    parameters: { readonly p_vehicle_id: string },
  ): HarnessQuery {
    return new QueryHarness(this, {
      source: 'rpc',
      rpcOperation: functionName,
      rpcVehicleId: parameters.p_vehicle_id,
    });
  }

  public resolve(state: QueryState, single: boolean): Promise<HarnessResponse> {
    const operation = this.readOperation(state);
    const denied = this.scenario.access === 'denied';
    const failure = this.scenario.failure?.operation === operation
      ? this.scenario.failure
      : undefined;

    if (denied || failure !== undefined) {
      const privateMarker = failure?.privateMarker ?? 'synthetic-access-denied';
      const failureKind = failure?.kind ?? 'unexpected';
      const providerCode = failureKind === 'missing_resource'
        ? state.source === 'rpc' ? 'PGRST202' : 'PGRST205'
        : failureKind === 'unexpected' ? 'PGRST000' : undefined;
      return Promise.resolve({
        data: null,
        error: denied
          ? { code: '42501', message: privateMarker }
          : {
              code: providerCode,
              details: `vehicles.notes=${privateMarker}`,
              hint: `archive_vehicle(${privateMarker})`,
              message: privateMarker,
              payload: { registration: privateMarker },
              query: `registration=${privateMarker}`,
            },
        status: denied
          ? 403
          : failureKind === 'unexpected' ? 503 : 404,
      });
    }

    return Promise.resolve({ data: this.execute(state, single), error: null, status: 200 });
  }

  private execute(state: QueryState, single: boolean): unknown {
    if (state.source === 'rpc') {
      return this.changeLifecycle(state);
    }

    switch (state.action) {
      case 'insert':
        return this.insert(state.values ?? {});
      case 'update':
        return this.update(state.id, state.values ?? {});
      case 'delete':
        return this.remove(state.id);
      case 'select':
      case undefined:
        return this.select(state, single);
    }

    return null;
  }

  private readOperation(state: QueryState): VehicleRepositoryContractOperation {
    if (state.rpcOperation === 'archive_vehicle') {
      return 'archive';
    }

    if (state.rpcOperation === 'restore_vehicle') {
      return 'restore';
    }

    switch (state.action) {
      case 'insert':
        return 'create';
      case 'update':
        return 'update';
      case 'delete':
        return 'delete';
      case 'select':
      case undefined:
        if (state.id !== undefined) {
          return 'getById';
        }

        if (state.lifecycle === 'active') {
          return 'listActive';
        }

        if (state.lifecycle === 'archived') {
          return 'listArchived';
        }

        return 'findDuplicate';
    }

    return 'findDuplicate';
  }

  private insert(values: Readonly<Record<string, unknown>>): VehicleRow {
    const row: VehicleRow = {
      id: createdVehicleId,
      owner_id: garageAdminId,
      ...values,
      archived_at: null,
      created_at: '2026-07-20T04:00:00.000Z',
      updated_at: '2026-07-20T04:00:00.000Z',
    };
    this.rows.push(row);
    return row;
  }

  private update(
    id: string | undefined,
    values: Readonly<Record<string, unknown>>,
  ): VehicleRow | null {
    const index = this.rows.findIndex((row) => row.id === id);

    if (index < 0) {
      return null;
    }

    const row = {
      ...this.rows[index],
      ...values,
      updated_at: '2026-07-20T05:00:00.000Z',
    } as VehicleRow;
    this.rows[index] = row;
    return row;
  }

  private remove(id: string | undefined): { readonly id: string } | null {
    const index = this.rows.findIndex((row) => row.id === id);

    if (index < 0) {
      return null;
    }

    const [removed] = this.rows.splice(index, 1);
    return removed === undefined ? null : { id: removed.id };
  }

  private select(state: QueryState, single: boolean): unknown {
    if (single) {
      return this.rows.find((row) => row.id === state.id) ?? null;
    }

    return [...this.rows]
      .filter((row) => (
        state.lifecycle === undefined
        || (state.lifecycle === 'active' && row.archived_at === null)
        || (state.lifecycle === 'archived' && row.archived_at !== null)
      ))
      .sort((left, right) => {
        const createdAtOrder = right.created_at.localeCompare(left.created_at);
        return createdAtOrder === 0
          ? left.id.localeCompare(right.id)
          : createdAtOrder;
      });
  }

  private changeLifecycle(state: QueryState): VehicleRow | null {
    const index = this.rows.findIndex((row) => row.id === state.rpcVehicleId);

    if (index < 0) {
      return null;
    }

    const row = {
      ...this.rows[index],
      archived_at: state.rpcOperation === 'archive_vehicle'
        ? '2026-07-20T06:00:00.000Z'
        : null,
      updated_at: '2026-07-20T06:00:00.000Z',
    } as VehicleRow;
    this.rows[index] = row;
    return row;
  }
}

function createSupabaseHarness(
  scenario: VehicleRepositoryContractScenario = {},
): VehicleRepositoryContractHarness {
  const client = new ClientHarness(scenario);

  return {
    fixtures: {
      activeVehicle,
      archivedDuplicateVehicle,
      createInput: {
        make: 'Ferrari',
        model: 'Purosangue',
        year: '2024',
        registration: 'SYN 456',
        registrationState: 'NSW',
        vin: 'SYNTHETIC-VIN-CREATED',
        currentOdometer: 900,
        odometerUnit: 'km',
        engine: 'Synthetic engine C',
        body: 'SUV',
        notes: 'Synthetic private Vehicle notes C',
      },
      createdVehicleId,
    },
    repository: new SupabaseVehicleRepository(client),
  };
}

describeVehicleRepositoryContract(
  'SupabaseVehicleRepository',
  createSupabaseHarness,
);
