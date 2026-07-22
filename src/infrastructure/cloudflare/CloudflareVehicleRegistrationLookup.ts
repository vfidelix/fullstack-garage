import type { VehicleRegistrationLookup } from '../../application/ports/vehicleRegistrationLookup';
import type { AccessTokenProvider } from '../../application/ports/accessTokenProvider';
import {
  isVehicleRegistrationSuggestion,
  type RegistrationLookupErrorCategory,
  type RegistrationLookupInput,
  type RegistrationLookupResult,
} from '../../domain/vehicles/registrationLookup';

const ENDPOINT = '/api/vehicle-registration-lookup';

function readRetryAfter(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= 86_400
    ? value
    : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isErrorCategory(value: unknown): value is RegistrationLookupErrorCategory {
  return value === 'invalid_input' || value === 'unauthenticated' || value === 'unauthorized'
    || value === 'not_configured' || value === 'rate_limited' || value === 'temporary_unavailable';
}

function mapResponse(value: unknown): RegistrationLookupResult {
  if (!isRecord(value)) return { status: 'error', category: 'temporary_unavailable' };
  if (value.status === 'no_match') return { status: 'no_match' };
  if (value.status === 'found' && Array.isArray(value.suggestions)
    && value.suggestions.length > 0 && value.suggestions.every(isVehicleRegistrationSuggestion)) {
    return { status: 'found', suggestions: value.suggestions };
  }
  if (value.status === 'error' && isErrorCategory(value.category)) {
    const retryAfterSeconds = readRetryAfter(value.retryAfterSeconds);
    return {
      status: 'error',
      category: value.category,
      ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
    };
  }
  return { status: 'error', category: 'temporary_unavailable' };
}

export class CloudflareVehicleRegistrationLookup implements VehicleRegistrationLookup {
  public constructor(
    private readonly accessTokenProvider: AccessTokenProvider,
  ) {}

  public async lookup(input: RegistrationLookupInput): Promise<RegistrationLookupResult> {
    let accessTokenResult: Awaited<ReturnType<AccessTokenProvider['getAccessToken']>>;

    try {
      accessTokenResult = await this.accessTokenProvider.getAccessToken();
    } catch {
      return { status: 'error', category: 'temporary_unavailable' };
    }

    if (accessTokenResult.status !== 'available') {
      return { status: 'error', category: accessTokenResult.status };
    }

    try {
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessTokenResult.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      });
      return mapResponse(await response.json() as unknown);
    } catch {
      return { status: 'error', category: 'temporary_unavailable' };
    }
  }
}
