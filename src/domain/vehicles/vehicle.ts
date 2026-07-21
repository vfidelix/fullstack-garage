import type { AppUserId } from '../users/appUser';

export const VEHICLE_YEAR_MIN = 1900;
export const VEHICLE_YEAR_MAX = 9999;
export const VEHICLE_TEXT_MAX_LENGTH = 50;
export const VEHICLE_NOTES_MAX_LENGTH = 500;
export const VEHICLE_ODOMETER_MAX = Number.MAX_SAFE_INTEGER;
export const ODOMETER_UNITS = ['km', 'mi'] as const;
export const AUSTRALIAN_REGISTRATION_STATES = [
  'ACT',
  'NSW',
  'NT',
  'QLD',
  'SA',
  'TAS',
  'VIC',
  'WA',
] as const;

export type VehicleId = string;

export type OdometerUnit = typeof ODOMETER_UNITS[number];
export type AustralianRegistrationState
  = typeof AUSTRALIAN_REGISTRATION_STATES[number];

export interface Vehicle {
  readonly id: VehicleId;
  readonly ownerId: AppUserId;
  readonly make: string;
  readonly model: string;
  readonly year?: number;
  readonly registration?: string;
  readonly registrationState?: AustralianRegistrationState;
  readonly vin?: string;
  readonly currentOdometer?: number;
  readonly odometerUnit: OdometerUnit;
  readonly engine?: string;
  readonly notes?: string;
  readonly archivedAt?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type VehicleSummary = Readonly<Pick<
  Vehicle,
  | 'id'
  | 'make'
  | 'model'
  | 'year'
  | 'registration'
  | 'registrationState'
  | 'currentOdometer'
  | 'odometerUnit'
  | 'archivedAt'
>>;

export interface CreateVehicle {
  readonly make: string;
  readonly model: string;
  readonly year?: number;
  readonly registration?: string;
  readonly registrationState?: string;
  readonly vin?: string;
  readonly currentOdometer?: number;
  readonly odometerUnit: OdometerUnit;
  readonly engine?: string;
  readonly notes?: string;
}

export type UpdateVehicle = CreateVehicle;

export type VehicleLifecycleState = 'active' | 'archived';

export type VehicleInputField = keyof CreateVehicle;

export type VehicleValidationIssueCode
  = | 'required'
    | 'too_long'
    | 'invalid_year'
    | 'invalid_registration_state'
    | 'invalid_odometer'
    | 'invalid_odometer_unit';

export interface VehicleValidationIssue {
  readonly field: VehicleInputField;
  readonly code: VehicleValidationIssueCode;
}

export type VehicleValidationResult<T>
  = | { readonly valid: true; readonly value: T }
    | { readonly valid: false; readonly issues: readonly VehicleValidationIssue[] };

export type VehicleLabelSource = Pick<CreateVehicle, 'make' | 'model'> & Partial<
  Pick<CreateVehicle, 'year' | 'registration' | 'registrationState'>
>;

export type VehicleDuplicateCandidate = Pick<
  CreateVehicle,
  'make' | 'model' | 'registration' | 'registrationState'
>;

type VehicleDuplicateSource = VehicleDuplicateCandidate & {
  readonly id: VehicleId;
};

function normalizeOptionalText(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalized = value.trim();
  return countVehicleTextCharacters(normalized) === 0 ? undefined : normalized;
}

function normalizeRegistrationState(
  value: string | undefined,
): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalized = value.trim().toUpperCase();
  return normalized === '' ? undefined : normalized;
}

export function countVehicleTextCharacters(value: string): number {
  return Array.from(value).length;
}

export function normalizeVehicleInput(input: CreateVehicle): CreateVehicle {
  const registration = normalizeOptionalText(input.registration);
  const registrationState = normalizeRegistrationState(input.registrationState);
  const vin = normalizeOptionalText(input.vin);
  const engine = normalizeOptionalText(input.engine);
  const notes = normalizeOptionalText(input.notes);

  return {
    make: input.make.trim(),
    model: input.model.trim(),
    ...(input.year === undefined ? {} : { year: input.year }),
    ...(registration === undefined ? {} : { registration }),
    ...(registrationState === undefined ? {} : { registrationState }),
    ...(vin === undefined ? {} : { vin }),
    ...(input.currentOdometer === undefined
      ? {}
      : { currentOdometer: input.currentOdometer }),
    odometerUnit: input.odometerUnit,
    ...(engine === undefined ? {} : { engine }),
    ...(notes === undefined ? {} : { notes }),
  };
}

function validateVehicleInput(input: CreateVehicle): VehicleValidationResult<CreateVehicle> {
  const normalized = normalizeVehicleInput(input);
  const issues: VehicleValidationIssue[] = [];

  if (countVehicleTextCharacters(normalized.make) === 0) {
    issues.push({ field: 'make', code: 'required' });
  } else if (
    countVehicleTextCharacters(normalized.make) > VEHICLE_TEXT_MAX_LENGTH
  ) {
    issues.push({ field: 'make', code: 'too_long' });
  }

  if (countVehicleTextCharacters(normalized.model) === 0) {
    issues.push({ field: 'model', code: 'required' });
  } else if (
    countVehicleTextCharacters(normalized.model) > VEHICLE_TEXT_MAX_LENGTH
  ) {
    issues.push({ field: 'model', code: 'too_long' });
  }

  if (
    normalized.year !== undefined
    && (!Number.isInteger(normalized.year)
      || normalized.year < VEHICLE_YEAR_MIN
      || normalized.year > VEHICLE_YEAR_MAX)
  ) {
    issues.push({ field: 'year', code: 'invalid_year' });
  }

  validateOptionalTextLength(normalized.registration, 'registration', issues);
  if (
    normalized.registrationState !== undefined
    && !isAustralianRegistrationState(normalized.registrationState)
  ) {
    issues.push({
      field: 'registrationState',
      code: 'invalid_registration_state',
    });
  }
  validateOptionalTextLength(normalized.vin, 'vin', issues);

  if (
    normalized.currentOdometer !== undefined
    && (!Number.isSafeInteger(normalized.currentOdometer)
      || normalized.currentOdometer < 0
      || normalized.currentOdometer > VEHICLE_ODOMETER_MAX)
  ) {
    issues.push({ field: 'currentOdometer', code: 'invalid_odometer' });
  }

  if (!isOdometerUnit(normalized.odometerUnit)) {
    issues.push({ field: 'odometerUnit', code: 'invalid_odometer_unit' });
  }

  validateOptionalTextLength(normalized.engine, 'engine', issues);

  if (
    normalized.notes !== undefined
    && countVehicleTextCharacters(normalized.notes) > VEHICLE_NOTES_MAX_LENGTH
  ) {
    issues.push({ field: 'notes', code: 'too_long' });
  }

  return issues.length === 0
    ? { valid: true, value: normalized }
    : { valid: false, issues };
}

function validateOptionalTextLength(
  value: string | undefined,
  field: 'registration' | 'vin' | 'engine',
  issues: VehicleValidationIssue[],
): void {
  if (
    value !== undefined
    && countVehicleTextCharacters(value) > VEHICLE_TEXT_MAX_LENGTH
  ) {
    issues.push({ field, code: 'too_long' });
  }
}

export function validateCreateVehicle(
  input: CreateVehicle,
): VehicleValidationResult<CreateVehicle> {
  return validateVehicleInput(input);
}

export function validateUpdateVehicle(
  input: UpdateVehicle,
): VehicleValidationResult<UpdateVehicle> {
  return validateVehicleInput(input);
}

export function isOdometerUnit(value: unknown): value is OdometerUnit {
  return value === 'km' || value === 'mi';
}

export function isAustralianRegistrationState(
  value: unknown,
): value is AustralianRegistrationState {
  return AUSTRALIAN_REGISTRATION_STATES.some((state) => state === value);
}

export function formatVehicleLabel(vehicle: VehicleLabelSource): string {
  const makeAndModel = `${vehicle.make.trim()} ${vehicle.model.trim()}`;
  const withYear = vehicle.year === undefined
    ? makeAndModel
    : `${String(vehicle.year)} ${makeAndModel}`;
  const registration = normalizeOptionalText(vehicle.registration);
  const registrationState = normalizeRegistrationState(vehicle.registrationState);

  return registration === undefined
    ? withYear
    : `${withYear} · ${registration}${
      registrationState === undefined ? '' : ` ${registrationState}`
    }`;
}

export function getVehicleLifecycleState(
  vehicle: Pick<Vehicle, 'archivedAt'>,
): VehicleLifecycleState {
  return vehicle.archivedAt === undefined ? 'active' : 'archived';
}

function normalizeDuplicateValue(value: string | undefined): string {
  return value?.replace(/\s/g, '').toLowerCase() ?? '';
}

function hasMatchingDuplicateKey(
  vehicle: VehicleDuplicateCandidate,
  candidate: VehicleDuplicateCandidate,
): boolean {
  const makeMatches = normalizeDuplicateValue(vehicle.make)
    === normalizeDuplicateValue(candidate.make);
  const modelMatches = normalizeDuplicateValue(vehicle.model)
    === normalizeDuplicateValue(candidate.model);
  const registrationMatches = normalizeDuplicateValue(vehicle.registration)
    === normalizeDuplicateValue(candidate.registration);
  const registrationStateMatches = normalizeDuplicateValue(vehicle.registrationState)
    === normalizeDuplicateValue(candidate.registrationState);

  return makeMatches && modelMatches && registrationMatches
    && registrationStateMatches;
}

export function findDuplicateVehicle<T extends VehicleDuplicateSource>(
  vehicles: readonly T[],
  candidate: VehicleDuplicateCandidate,
  excludeVehicleId?: VehicleId,
): T | undefined {
  return vehicles.find((vehicle) => (
    vehicle.id !== excludeVehicleId
    && hasMatchingDuplicateKey(vehicle, candidate)
  ));
}
