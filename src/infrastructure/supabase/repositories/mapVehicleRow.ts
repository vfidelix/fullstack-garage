import {
  isAustralianRegistrationState,
  isOdometerUnit,
  validateCreateVehicle,
  type AustralianRegistrationState,
  type CreateVehicle,
  type Vehicle,
  type VehicleSummary,
} from '../../../domain/vehicles/vehicle';

const UUID_PATTERN = /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/iu;

type UnknownRecord = Readonly<Record<string, unknown>>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isIdentifier(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

function isTimestamp(value: unknown): value is string {
  return typeof value === 'string'
    && value.trim() !== ''
    && !Number.isNaN(Date.parse(value));
}

function isRequiredText(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

function isNullableText(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isNullableRegistrationState(value: unknown): value is string | null {
  return value === null
    || (typeof value === 'string' && isAustralianRegistrationState(value));
}

function isNullableInteger(value: unknown): value is number | null {
  return value === null || Number.isSafeInteger(value);
}

function isNullableTimestamp(value: unknown): value is string | null {
  return value === null || isTimestamp(value);
}

function hasSummaryShape(value: UnknownRecord): boolean {
  return isIdentifier(value.id)
    && isRequiredText(value.make)
    && isRequiredText(value.model)
    && isNullableInteger(value.year)
    && isNullableText(value.registration)
    && isNullableRegistrationState(value.registration_state)
    && isNullableInteger(value.current_odometer)
    && isOdometerUnit(value.odometer_unit)
    && isNullableTimestamp(value.archived_at);
}

export function mapVehicleSummaryRow(value: unknown): VehicleSummary | null {
  if (!isRecord(value) || !hasSummaryShape(value)) {
    return null;
  }

  const year = value.year as number | null;
  const registration = value.registration as string | null;
  const registrationState = value.registration_state as string | null;
  const currentOdometer = value.current_odometer as number | null;
  const archivedAt = value.archived_at as string | null;
  const validation = validateCreateVehicle({
    make: value.make as string,
    model: value.model as string,
    ...(year === null ? {} : { year }),
    ...(registration === null ? {} : { registration }),
    ...(registrationState === null ? {} : { registrationState }),
    ...(currentOdometer === null ? {} : { currentOdometer }),
    odometerUnit: value.odometer_unit as CreateVehicle['odometerUnit'],
  });

  if (!validation.valid) {
    return null;
  }

  return {
    id: value.id as string,
    make: validation.value.make,
    model: validation.value.model,
    ...(validation.value.year === undefined
      ? {}
      : { year: validation.value.year }),
    ...(validation.value.registration === undefined
      ? {}
      : { registration: validation.value.registration }),
    ...(validation.value.registrationState === undefined
      ? {}
      : {
          registrationState: validation.value
            .registrationState as AustralianRegistrationState,
        }),
    ...(validation.value.currentOdometer === undefined
      ? {}
      : { currentOdometer: validation.value.currentOdometer }),
    odometerUnit: validation.value.odometerUnit,
    ...(archivedAt === null ? {} : { archivedAt }),
  };
}

export function mapVehicleRow(value: unknown): Vehicle | null {
  if (
    !isRecord(value)
    || !hasSummaryShape(value)
    || !isIdentifier(value.owner_id)
    || !isNullableText(value.vin)
    || !isNullableText(value.engine)
    || !isNullableText(value.notes)
    || !isTimestamp(value.created_at)
    || !isTimestamp(value.updated_at)
  ) {
    return null;
  }

  const summary = mapVehicleSummaryRow(value);

  if (summary === null) {
    return null;
  }

  const vin = value.vin;
  const engine = value.engine;
  const notes = value.notes;
  const validation = validateCreateVehicle({
    make: summary.make,
    model: summary.model,
    ...(summary.year === undefined ? {} : { year: summary.year }),
    ...(summary.registration === undefined
      ? {}
      : { registration: summary.registration }),
    ...(summary.registrationState === undefined
      ? {}
      : { registrationState: summary.registrationState }),
    ...(vin === null ? {} : { vin }),
    ...(summary.currentOdometer === undefined
      ? {}
      : { currentOdometer: summary.currentOdometer }),
    odometerUnit: summary.odometerUnit,
    ...(engine === null ? {} : { engine }),
    ...(notes === null ? {} : { notes }),
  });

  if (!validation.valid) {
    return null;
  }

  return {
    ...summary,
    ownerId: value.owner_id,
    ...(validation.value.vin === undefined ? {} : { vin: validation.value.vin }),
    ...(validation.value.engine === undefined
      ? {}
      : { engine: validation.value.engine }),
    ...(validation.value.notes === undefined
      ? {}
      : { notes: validation.value.notes }),
    createdAt: value.created_at,
    updatedAt: value.updated_at,
  };
}
