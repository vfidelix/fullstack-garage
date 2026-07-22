import {
  AUSTRALIAN_REGISTRATION_STATES,
  VEHICLE_NOTES_MAX_LENGTH,
  VEHICLE_TEXT_MAX_LENGTH,
  countVehicleTextCharacters,
  isAustralianRegistrationState,
  type AustralianRegistrationState,
} from './vehicle';

export const REGISTRATION_LOOKUP_MAX_LENGTH = VEHICLE_TEXT_MAX_LENGTH;
const VEHICLE_REGISTRATION_SUGGESTION_FIELDS = new Set([
  'make',
  'model',
  'year',
  'engine',
  'body',
  'detailedDescription',
  'registrationState',
]);

export interface RegistrationLookupInput {
  readonly registration: string;
  readonly registrationState: AustralianRegistrationState;
}

export interface VehicleRegistrationSuggestion {
  readonly make?: string;
  readonly model?: string;
  readonly year?: string;
  readonly engine?: string;
  readonly body?: string;
  readonly detailedDescription?: string;
  readonly registrationState: AustralianRegistrationState;
}

export type RegistrationLookupErrorCategory
  = | 'invalid_input'
    | 'unauthenticated'
    | 'unauthorized'
    | 'not_configured'
    | 'rate_limited'
    | 'temporary_unavailable';

export type RegistrationLookupResult
  = | { readonly status: 'found'; readonly suggestions: readonly VehicleRegistrationSuggestion[] }
    | { readonly status: 'no_match' }
    | {
      readonly status: 'error';
      readonly category: RegistrationLookupErrorCategory;
      readonly retryAfterSeconds?: number;
    };

export function normalizeRegistrationForLookup(registration: string): string {
  return registration.trim().toUpperCase().replace(/[\s-]+/gu, '');
}

export function validateRegistrationLookupInput(value: unknown): RegistrationLookupInput | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }

  const { registration, registrationState } = value as Record<string, unknown>;
  if (
    Object.keys(value).some((key) => key !== 'registration' && key !== 'registrationState')
    || typeof registration !== 'string'
    || registration.trim().length === 0
    || registration.length > REGISTRATION_LOOKUP_MAX_LENGTH
    || typeof registrationState !== 'string'
    || !isAustralianRegistrationState(registrationState)
  ) {
    return null;
  }

  return { registration: registration.trim(), registrationState };
}

export function isVehicleRegistrationSuggestion(value: unknown): value is VehicleRegistrationSuggestion {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  const hasOnlyAllowedFields = Object.keys(candidate).every(
    (field) => VEHICLE_REGISTRATION_SUGGESTION_FIELDS.has(field),
  );

  return hasOnlyAllowedFields
    && AUSTRALIAN_REGISTRATION_STATES.includes(candidate.registrationState as AustralianRegistrationState)
    && optionalSuggestionText(candidate.make)
    && optionalSuggestionText(candidate.model)
    && optionalSuggestionText(candidate.year)
    && optionalSuggestionText(candidate.engine)
    && optionalSuggestionText(candidate.body)
    && optionalSuggestionText(candidate.detailedDescription, VEHICLE_NOTES_MAX_LENGTH);
}

function optionalSuggestionText(
  value: unknown,
  maximumLength = VEHICLE_TEXT_MAX_LENGTH,
): boolean {
  return value === undefined
    || (typeof value === 'string'
      && value.trim().length > 0
      && value === value.trim()
      && countVehicleTextCharacters(value) <= maximumLength);
}
