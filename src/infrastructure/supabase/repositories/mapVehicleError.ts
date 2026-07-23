import {
  createVehicleError,
  createVehicleValidationError,
  type VehicleError,
} from '../../../application/vehicles/vehicleResult';

const VALIDATION_CODES = new Set([
  '22001',
  '22003',
  '22P02',
  '23502',
  '23514',
]);
const NOT_FOUND_CODES = new Set(['P0002']);
const UNAUTHORIZED_CODES = new Set(['42501', 'PGRST301', 'PGRST302']);

interface ErrorFacts {
  readonly code: string | null;
  readonly status: number | null;
}

export type VehicleProviderOperation = 'archive' | 'delete' | 'restore' | 'update';

function readErrorFacts(error: unknown): ErrorFacts {
  if (typeof error !== 'object' || error === null) {
    return { code: null, status: null };
  }

  return {
    code: 'code' in error && typeof error.code === 'string'
      ? error.code
      : null,
    status: 'status' in error && typeof error.status === 'number'
      ? error.status
      : null,
  };
}

export function mapSupabaseVehicleError(
  error: unknown,
  operation?: VehicleProviderOperation,
): VehicleError {
  const facts = readErrorFacts(error);

  if (facts.code !== null && VALIDATION_CODES.has(facts.code)) {
    return createVehicleValidationError([]);
  }

  if (facts.code !== null && NOT_FOUND_CODES.has(facts.code)) {
    return createVehicleError('not_found');
  }

  if (
    facts.status === 401
    || facts.status === 403
    || (facts.code !== null && UNAUTHORIZED_CODES.has(facts.code))
  ) {
    return createVehicleError('unauthorized');
  }

  if (facts.code === '55000') {
    if (operation === 'delete' || operation === 'update') {
      return createVehicleError('service_record_history_conflict');
    }

    return createVehicleError('lifecycle_conflict');
  }

  return createVehicleError('temporary_failure');
}
