import { describe, expect, it } from 'vitest';
import { VEHICLE_ODOMETER_MAX } from '../../../domain/vehicles/vehicle';
import type { VehicleRepositoryClient } from './SupabaseVehicleRepository';
import { SupabaseVehicleRepository } from './SupabaseVehicleRepository';

type HarnessQuery = ReturnType<VehicleRepositoryClient['from']>;
type HarnessResponse = Awaited<HarnessQuery>;

interface HarnessCall {
  readonly method: string;
  readonly arguments: readonly unknown[];
}

type QueuedOutcome
  = { readonly response: HarnessResponse }
    | { readonly rejection: Error };

class QueryHarness implements HarnessQuery {
  public constructor(
    private readonly outcome: QueuedOutcome,
    private readonly calls: HarnessCall[],
  ) {}

  public select(columns: string): HarnessQuery {
    return this.record('select', columns);
  }

  public insert(values: Readonly<Record<string, unknown>>): HarnessQuery {
    return this.record('insert', values);
  }

  public update(values: Readonly<Record<string, unknown>>): HarnessQuery {
    return this.record('update', values);
  }

  public delete(): HarnessQuery {
    return this.record('delete');
  }

  public eq(column: 'id', value: string): HarnessQuery {
    return this.record('eq', column, value);
  }

  public is(column: 'archived_at', value: null): HarnessQuery {
    return this.record('is', column, value);
  }

  public not(
    column: 'archived_at',
    operator: 'is',
    value: null,
  ): HarnessQuery {
    return this.record('not', column, operator, value);
  }

  public order(
    column: 'created_at' | 'id',
    options: { readonly ascending: boolean },
  ): HarnessQuery {
    return this.record('order', column, options);
  }

  public maybeSingle(): PromiseLike<HarnessResponse> {
    this.calls.push({ method: 'maybeSingle', arguments: [] });
    return this.toPromise();
  }

  public then<TResult1 = HarnessResponse, TResult2 = never>(
    onfulfilled?: ((value: HarnessResponse) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.toPromise().then(onfulfilled, onrejected);
  }

  private record(method: string, ...arguments_: readonly unknown[]): HarnessQuery {
    this.calls.push({ method, arguments: arguments_ });
    return this;
  }

  private toPromise(): Promise<HarnessResponse> {
    return 'response' in this.outcome
      ? Promise.resolve(this.outcome.response)
      : Promise.reject(this.outcome.rejection);
  }
}

class ClientHarness implements VehicleRepositoryClient {
  public readonly calls: HarnessCall[] = [];

  public constructor(private readonly outcomes: QueuedOutcome[]) {}

  public from(table: 'vehicles'): HarnessQuery {
    this.calls.push({ method: 'from', arguments: [table] });
    return new QueryHarness(this.nextOutcome(), this.calls);
  }

  public rpc(
    functionName: 'archive_vehicle' | 'restore_vehicle',
    parameters: { readonly p_vehicle_id: string },
  ): HarnessQuery {
    this.calls.push({ method: 'rpc', arguments: [functionName, parameters] });
    return new QueryHarness(this.nextOutcome(), this.calls);
  }

  private nextOutcome(): QueuedOutcome {
    const outcome = this.outcomes.shift();

    if (outcome === undefined) {
      throw new Error('The typed Vehicle client harness has no queued outcome.');
    }

    return outcome;
  }
}

const vehicleId = '10000000-0000-4000-8000-000000000001';
const ownerId = '20000000-0000-4000-8000-000000000001';
const secondVehicleId = '10000000-0000-4000-8000-000000000002';
const nonBmpCharacter = '\u{1F600}';

const activeRow = {
  id: vehicleId,
  owner_id: ownerId,
  make: 'Ferrari',
  model: 'Roma',
  year: '2018-2021',
  registration: 'TEST 123',
  registration_state: 'WA',
  vin: 'SYNTHETIC-VIN',
  current_odometer: 12_500,
  odometer_unit: 'km',
  engine: 'Synthetic V8',
  body: 'Coupe',
  notes: 'Synthetic notes',
  archived_at: null,
  created_at: '2026-07-20T01:00:00.000Z',
  updated_at: '2026-07-20T02:00:00.000Z',
};

const archivedRow = {
  ...activeRow,
  id: secondVehicleId,
  archived_at: '2026-07-20T03:00:00.000Z',
};

function summaryRow(row: typeof activeRow | typeof archivedRow) {
  return {
    id: row.id,
    make: row.make,
    model: row.model,
    year: row.year,
    registration: row.registration,
    registration_state: row.registration_state,
    current_odometer: row.current_odometer,
    odometer_unit: row.odometer_unit,
    archived_at: row.archived_at,
  };
}

function response(data: unknown, error: unknown = null, status = 200): QueuedOutcome {
  return { response: { data, error, status } };
}

function rejection(error: Error): QueuedOutcome {
  return { rejection: error };
}

function createHarness(...outcomes: QueuedOutcome[]) {
  const client = new ClientHarness(outcomes);
  return { client, repository: new SupabaseVehicleRepository(client) };
}

describe('SupabaseVehicleRepository', () => {
  it('lists active and archived Vehicles separately with deterministic ordering', async () => {
    const { client, repository } = createHarness(
      response([summaryRow(activeRow)]),
      response([summaryRow(archivedRow)]),
    );

    const activeResult = await repository.listActive();

    expect(activeResult).toMatchObject({
      ok: true,
      value: [{ id: vehicleId }],
    });
    expect(activeResult.ok && activeResult.value[0]).not.toHaveProperty('archivedAt');
    await expect(repository.listArchived()).resolves.toMatchObject({
      ok: true,
      value: [{ id: secondVehicleId, archivedAt: archivedRow.archived_at }],
    });

    expect(client.calls.filter((call) => call.method === 'order')).toEqual([
      { method: 'order', arguments: ['created_at', { ascending: false }] },
      { method: 'order', arguments: ['id', { ascending: true }] },
      { method: 'order', arguments: ['created_at', { ascending: false }] },
      { method: 'order', arguments: ['id', { ascending: true }] },
    ]);
    expect(client.calls).toContainEqual({
      method: 'is',
      arguments: ['archived_at', null],
    });
    expect(client.calls).toContainEqual({
      method: 'not',
      arguments: ['archived_at', 'is', null],
    });
    expect(client.calls.filter((call) => call.method === 'select')).toEqual([
      expect.objectContaining({
        arguments: [expect.not.stringContaining('body')],
      }),
      expect.objectContaining({
        arguments: [expect.not.stringContaining('body')],
      }),
    ]);
  });

  it('gets, creates, and updates Vehicles without forwarding an owner ID', async () => {
    const { client, repository } = createHarness(
      response(activeRow),
      response(activeRow),
      response({ ...activeRow, model: 'Roma Spider' }),
    );
    const input = {
      make: ' Ferrari ',
      model: ' Roma ',
      year: ' 2018-2021 ',
      registration: ' TEST 123 ',
      registrationState: ' wa ',
      body: ' Coupe ',
      odometerUnit: 'km' as const,
    };

    await expect(repository.getById(vehicleId)).resolves.toMatchObject({
      ok: true,
      value: { id: vehicleId, ownerId },
    });
    await expect(repository.create(input)).resolves.toMatchObject({ ok: true });
    await expect(repository.update(vehicleId, {
      ...input,
      model: 'Roma Spider',
    })).resolves.toMatchObject({
      ok: true,
      value: { model: 'Roma Spider' },
    });

    const writes = client.calls.filter((call) => (
      call.method === 'insert' || call.method === 'update'
    ));
    expect(writes).toHaveLength(2);
    expect(writes[0]?.arguments[0]).toEqual(expect.objectContaining({
      make: 'Ferrari',
      model: 'Roma',
      registration: 'TEST 123',
      registration_state: 'WA',
      year: '2018-2021',
      body: 'Coupe',
      odometer_unit: 'km',
    }));
    expect(writes[0]?.arguments[0]).not.toHaveProperty('owner_id');
    expect(writes[1]?.arguments[0]).not.toHaveProperty('owner_id');
    expect(client.calls.filter((call) => call.method === 'select')).toEqual([
      expect.objectContaining({ arguments: [expect.stringContaining('body')] }),
      expect.objectContaining({ arguments: [expect.stringContaining('body')] }),
      expect.objectContaining({ arguments: [expect.stringContaining('body')] }),
    ]);
  });

  it('maps create and update responses at the accepted odometer maximum', async () => {
    const boundaryRow = {
      ...activeRow,
      current_odometer: VEHICLE_ODOMETER_MAX,
    };
    const { repository } = createHarness(
      response(boundaryRow),
      response(boundaryRow),
    );
    const input = {
      make: 'Ferrari',
      model: 'Roma',
      currentOdometer: VEHICLE_ODOMETER_MAX,
      odometerUnit: 'km' as const,
    };

    await expect(repository.create(input)).resolves.toMatchObject({
      ok: true,
      value: { currentOdometer: VEHICLE_ODOMETER_MAX },
    });
    await expect(repository.update(vehicleId, input)).resolves.toMatchObject({
      ok: true,
      value: { currentOdometer: VEHICLE_ODOMETER_MAX },
    });
  });

  it('maps valid non-BMP create, update, archive, and restore responses', async () => {
    const boundaryRow = {
      ...activeRow,
      make: nonBmpCharacter.repeat(50),
      model: nonBmpCharacter.repeat(50),
      registration: nonBmpCharacter.repeat(50),
      registration_state: 'TAS',
      vin: nonBmpCharacter.repeat(50),
      engine: nonBmpCharacter.repeat(50),
      body: nonBmpCharacter.repeat(50),
      notes: nonBmpCharacter.repeat(500),
    };
    const archivedBoundaryRow = {
      ...boundaryRow,
      archived_at: '2026-07-20T03:00:00.000Z',
    };
    const { repository } = createHarness(
      response(boundaryRow),
      response(boundaryRow),
      response(archivedBoundaryRow),
      response(boundaryRow),
    );
    const input = {
      make: boundaryRow.make,
      model: boundaryRow.model,
      registration: boundaryRow.registration,
      registrationState: 'TAS',
      vin: boundaryRow.vin,
      odometerUnit: 'km' as const,
      engine: boundaryRow.engine,
      body: boundaryRow.body,
      notes: boundaryRow.notes,
    };

    await expect(repository.create(input)).resolves.toMatchObject({
      ok: true,
      value: { notes: boundaryRow.notes },
    });
    await expect(repository.update(vehicleId, input)).resolves.toMatchObject({
      ok: true,
      value: { make: boundaryRow.make },
    });
    await expect(repository.archive(vehicleId)).resolves.toMatchObject({
      ok: true,
      value: { archivedAt: archivedBoundaryRow.archived_at },
    });
    await expect(repository.restore(vehicleId)).resolves.toMatchObject({
      ok: true,
      value: { registration: boundaryRow.registration },
    });
  });

  it('validates registration state writes before calling the provider', async () => {
    const { client, repository } = createHarness();

    await expect(repository.create({
      make: 'Ferrari',
      model: 'Roma',
      registrationState: 'NZ',
      odometerUnit: 'km',
    })).resolves.toMatchObject({
      ok: false,
      error: { category: 'validation' },
    });
    expect(client.calls).toEqual([]);
  });

  it('rejects over-bound non-BMP create and update values before writes', async () => {
    const { client, repository } = createHarness();

    await expect(repository.create({
      make: 'Ferrari',
      model: 'Roma',
      odometerUnit: 'km',
      notes: nonBmpCharacter.repeat(501),
    })).resolves.toMatchObject({
      ok: false,
      error: { category: 'validation' },
    });
    await expect(repository.update(vehicleId, {
      make: nonBmpCharacter.repeat(51),
      model: 'Roma',
      odometerUnit: 'km',
    })).resolves.toMatchObject({
      ok: false,
      error: { category: 'validation' },
    });
    expect(client.calls).toEqual([]);
  });

  it('validates writes before calling the provider', async () => {
    const { client, repository } = createHarness();

    await expect(repository.create({
      make: '',
      model: 'Roma',
      odometerUnit: 'km',
    })).resolves.toMatchObject({
      ok: false,
      error: { category: 'validation' },
    });
    await expect(repository.update(vehicleId, {
      make: 'Ferrari',
      model: 'Roma',
      currentOdometer: -1,
      odometerUnit: 'km',
    })).resolves.toMatchObject({
      ok: false,
      error: { category: 'validation' },
    });
    await expect(repository.create({
      make: 'Ferrari',
      model: 'Roma',
      currentOdometer: VEHICLE_ODOMETER_MAX + 1,
      odometerUnit: 'km',
    })).resolves.toMatchObject({
      ok: false,
      error: { category: 'validation' },
    });
    expect(client.calls).toEqual([]);
  });

  it('uses atomic lifecycle RPCs and confirms the current delete result', async () => {
    const { client, repository } = createHarness(
      response({ ...activeRow, archived_at: archivedRow.archived_at }),
      response(activeRow),
      response({ id: vehicleId }),
    );

    await expect(repository.archive(vehicleId)).resolves.toMatchObject({
      ok: true,
      value: { archivedAt: archivedRow.archived_at },
    });
    await expect(repository.restore(vehicleId)).resolves.toMatchObject({
      ok: true,
      value: { id: vehicleId },
    });
    await expect(repository.delete(vehicleId)).resolves.toEqual({
      ok: true,
      value: undefined,
    });

    expect(client.calls.filter((call) => call.method === 'rpc')).toEqual([
      {
        method: 'rpc',
        arguments: ['archive_vehicle', { p_vehicle_id: vehicleId }],
      },
      {
        method: 'rpc',
        arguments: ['restore_vehicle', { p_vehicle_id: vehicleId }],
      },
    ]);
  });

  it('finds duplicates across lifecycle states and excludes the current Vehicle', async () => {
    const rows = [summaryRow(activeRow), summaryRow(archivedRow)];
    const { repository } = createHarness(response(rows), response(rows));
    const candidate = {
      make: ' FERRARI ',
      model: 'ro ma',
      registration: 'test123',
      registrationState: 'wa',
    };

    await expect(repository.findDuplicate(candidate)).resolves.toEqual({
      ok: true,
      value: {
        vehicleId,
        label: '2018-2021 Ferrari Roma · TEST 123 WA',
      },
    });
    await expect(
      repository.findDuplicate(candidate, vehicleId),
    ).resolves.toEqual({
      ok: true,
      value: {
        vehicleId: secondVehicleId,
        label: '2018-2021 Ferrari Roma · TEST 123 WA',
      },
    });
  });

  it('does not warn for a same-registration duplicate in another state', async () => {
    const rows = [summaryRow(activeRow), summaryRow(archivedRow)];
    const { repository } = createHarness(response(rows));

    await expect(repository.findDuplicate({
      make: 'Ferrari',
      model: 'Roma',
      registration: 'TEST 123',
      registrationState: 'VIC',
    })).resolves.toEqual({
      ok: true,
      value: undefined,
    });
  });

  it('returns not found for successful single-row operations with no row', async () => {
    const { repository } = createHarness(response(null), response(null));

    await expect(repository.getById(vehicleId)).resolves.toMatchObject({
      ok: false,
      error: { category: 'not_found' },
    });
    await expect(repository.delete(vehicleId)).resolves.toMatchObject({
      ok: false,
      error: { category: 'not_found' },
    });
  });

  it('rejects malformed and lifecycle-crossing provider results', async () => {
    const { repository } = createHarness(
      response([{ ...summaryRow(activeRow), current_odometer: -1 }]),
      response([summaryRow(archivedRow)]),
      response(activeRow),
    );

    await expect(repository.listActive()).resolves.toMatchObject({
      ok: false,
      error: { category: 'temporary_failure' },
    });
    await expect(repository.listActive()).resolves.toMatchObject({
      ok: false,
      error: { category: 'temporary_failure' },
    });
    await expect(repository.archive(vehicleId)).resolves.toMatchObject({
      ok: false,
      error: { category: 'temporary_failure' },
    });
  });

  it('maps response and thrown failures without exposing private details', async () => {
    const privateMarker = 'private-vehicle-provider-sentinel';
    const { repository } = createHarness(
      response(null, {
        code: '42501',
        message: privateMarker,
        details: `vehicles.notes=${privateMarker}`,
      }, 403),
      rejection(Object.assign(new Error(privateMarker), {
        code: 'PGRST000',
        query: `registration=${privateMarker}`,
      })),
    );

    const unauthorized = await repository.getById(vehicleId);
    const temporary = await repository.listArchived();

    expect(unauthorized).toMatchObject({
      ok: false,
      error: { category: 'unauthorized' },
    });
    expect(temporary).toMatchObject({
      ok: false,
      error: { category: 'temporary_failure' },
    });
    expect(JSON.stringify([unauthorized, temporary])).not.toContain(privateMarker);
  });

  it('maps lifecycle and database validation failures to fixed app-owned errors', async () => {
    const { repository } = createHarness(
      response(null, { code: '55000', message: 'private lifecycle detail' }),
      response(null, { code: '23514', message: 'private constraint detail' }),
    );

    await expect(repository.restore(vehicleId)).resolves.toMatchObject({
      ok: false,
      error: { category: 'lifecycle_conflict' },
    });
    await expect(repository.create({
      make: 'Ferrari',
      model: 'Roma',
      odometerUnit: 'km',
    })).resolves.toMatchObject({
      ok: false,
      error: { category: 'validation', issues: [] },
    });
  });

  it('maps completed Service Record history guards only for delete and update', async () => {
    const update = createHarness(response(null, { code: '55000' }));
    const remove = createHarness(response(null, { code: '55000' }));
    const input = {
      make: 'Ferrari',
      model: 'Roma',
      odometerUnit: 'mi' as const,
    };

    await expect(update.repository.update(vehicleId, input)).resolves.toMatchObject({
      ok: false,
      error: { category: 'service_record_history_conflict' },
    });
    await expect(remove.repository.delete(vehicleId)).resolves.toMatchObject({
      ok: false,
      error: { category: 'service_record_history_conflict' },
    });
  });
});
