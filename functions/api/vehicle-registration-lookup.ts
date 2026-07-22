export interface PlateApiProxyEnv {
  readonly PLATEAPI_API_KEY?: string;
  readonly SUPABASE_URL?: string;
  readonly SUPABASE_PUBLISHABLE_KEY?: string;
}

const states = new Set(['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA']);
const textLimit = 50;
const notesLimit = 500;
const yearMinimum = 1900;
const yearMaximum = 9999;
const timeoutMilliseconds = 8_000;
const responseLimitBytes = 64 * 1024;

type SafeResult
  = | { readonly status: 'found'; readonly suggestions: readonly Record<string, unknown>[] }
    | { readonly status: 'no_match' }
    | { readonly status: 'error'; readonly category: string; readonly retryAfterSeconds?: number };

type AuthorizationResult = 'authorized' | 'missing_config' | 'unauthorized';

function response(result: SafeResult, status = 200): Response {
  return Response.json(result, { status, headers: { 'Cache-Control': 'no-store' } });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validText(value: unknown, maximumLength = textLimit): value is string {
  return typeof value === 'string'
    && value.trim().length > 0
    && Array.from(value.trim()).length <= maximumLength;
}

function optionalText(value: unknown, maximumLength = textLimit): string | null | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  return Array.from(trimmed).length <= maximumLength ? trimmed : null;
}

function validYearBound(value: unknown): value is number {
  return typeof value === 'number'
    && Number.isInteger(value)
    && value >= yearMinimum
    && value <= yearMaximum;
}

function safeSuggestion(vehicle: unknown, registrationState: string): Record<string, unknown> | null {
  if (!isRecord(vehicle)) return null;
  const suggestion: Record<string, unknown> = { registrationState };
  for (const field of ['make', 'model', 'engine', 'body'] as const) {
    const text = optionalText(vehicle[field]);
    if (text === null) return null;
    if (text !== undefined) suggestion[field] = text;
  }

  const yearRange = optionalText(vehicle.year_range);
  if (yearRange === null) return null;
  if (yearRange !== undefined) {
    suggestion.year = yearRange;
  } else {
    const low = vehicle.lowest_year;
    const high = vehicle.highest_year;
    if ((low !== undefined && low !== null) || (high !== undefined && high !== null)) {
      if (!validYearBound(low) || !validYearBound(high)) return null;
      if (low === high) suggestion.year = String(low);
    }
  }

  const detailedDescription = optionalText(vehicle.detailed_description, notesLimit);
  if (detailedDescription === null) return null;
  if (detailedDescription !== undefined) suggestion.detailedDescription = detailedDescription;

  return suggestion;
}

async function readLimitedJson(providerResponse: Response): Promise<unknown> {
  const length = Number(providerResponse.headers.get('content-length'));
  if (Number.isFinite(length) && length > responseLimitBytes) throw new Error('response_too_large');
  const body = await providerResponse.arrayBuffer();
  if (body.byteLength > responseLimitBytes) throw new Error('response_too_large');
  return JSON.parse(new TextDecoder().decode(body)) as unknown;
}

async function authorize(
  request: Request,
  env: PlateApiProxyEnv,
  signal: AbortSignal,
): Promise<AuthorizationResult> {
  const bearer = request.headers.get('authorization');
  if (bearer === null || !/^Bearer\s+\S+$/iu.test(bearer)) return 'unauthorized';
  if (env.SUPABASE_URL === undefined || env.SUPABASE_PUBLISHABLE_KEY === undefined) return 'missing_config';
  const headers = { Authorization: bearer, apikey: env.SUPABASE_PUBLISHABLE_KEY };
  const user = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, { headers, signal });
  if (!user.ok) return 'unauthorized';
  const admin = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/is_garage_admin`, {
    method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: '{}', signal,
  });
  return admin.ok && (await admin.json() as unknown) === true ? 'authorized' : 'unauthorized';
}

function retryAfterSeconds(value: string | null): number | undefined {
  if (value === null || !/^\d+$/u.test(value)) return undefined;
  const seconds = Number(value);
  return Number.isSafeInteger(seconds) && seconds > 0 && seconds <= 86_400 ? seconds : undefined;
}

export async function handleVehicleRegistrationLookup(
  request: Request,
  env: PlateApiProxyEnv,
): Promise<Response> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return response({ status: 'error', category: 'invalid_input' }, 400);
  }
  if (!isRecord(raw) || !validText(raw.registration) || typeof raw.registrationState !== 'string'
    || !states.has(raw.registrationState) || Object.keys(raw).some((key) => key !== 'registration' && key !== 'registrationState')) {
    return response({ status: 'error', category: 'invalid_input' }, 400);
  }
  const abort = new AbortController();
  const timer = setTimeout(() => {
    abort.abort();
  }, timeoutMilliseconds);
  try {
    const authorization = await authorize(request, env, abort.signal);
    if (authorization === 'missing_config') return response({ status: 'error', category: 'not_configured' }, 503);
    if (authorization === 'unauthorized') return response({ status: 'error', category: 'unauthorized' }, 403);
    if (env.PLATEAPI_API_KEY === undefined || env.PLATEAPI_API_KEY.trim() === '') {
      return response({ status: 'error', category: 'not_configured' }, 503);
    }
    const registration = raw.registration;
    const registrationState = raw.registrationState;
    const plate = registration.trim().toUpperCase().replace(/[\s-]+/gu, '');
    const url = new URL('https://api.plateapi.com.au/api/v1/lookup');
    url.searchParams.set('plate', plate);
    url.searchParams.set('state', registrationState);
    url.searchParams.set('detailed', 'true');
    const provider = await fetch(url, { headers: { 'X-API-Key': env.PLATEAPI_API_KEY }, signal: abort.signal });
    if (provider.status === 400) return response({ status: 'error', category: 'invalid_input' }, 400);
    if (provider.status === 401) return response({ status: 'error', category: 'not_configured' }, 503);
    if (provider.status === 429) {
      const retryAfter = retryAfterSeconds(provider.headers.get('retry-after'));
      return response({ status: 'error', category: 'rate_limited', ...(retryAfter === undefined ? {} : { retryAfterSeconds: retryAfter }) }, 429);
    }
    if (!provider.ok) return response({ status: 'error', category: 'temporary_unavailable' }, 503);
    const data = await readLimitedJson(provider);
    if (!isRecord(data)) return response({ status: 'error', category: 'temporary_unavailable' }, 503);
    if (data.success === false) return response({ status: 'no_match' });
    if (data.success !== true || !isRecord(data.vehicle)) return response({ status: 'error', category: 'temporary_unavailable' }, 503);
    const primary = safeSuggestion(data.vehicle, registrationState);
    if (primary === null) return response({ status: 'error', category: 'temporary_unavailable' }, 503);
    const alternatives = data.alternatives === undefined ? [] : data.alternatives;
    if (!Array.isArray(alternatives)) return response({ status: 'error', category: 'temporary_unavailable' }, 503);
    const mappedAlternatives = alternatives.map((item) => safeSuggestion(item, registrationState));
    if (mappedAlternatives.some((item) => item === null)) return response({ status: 'error', category: 'temporary_unavailable' }, 503);
    return response({ status: 'found', suggestions: [primary, ...mappedAlternatives.filter((item): item is Record<string, unknown> => item !== null)] });
  } catch {
    return response({ status: 'error', category: 'temporary_unavailable' }, 503);
  } finally {
    clearTimeout(timer);
  }
}

export const onRequestPost = async ({
  request,
  env,
}: { readonly request: Request; readonly env: PlateApiProxyEnv }): Promise<Response> =>
  handleVehicleRegistrationLookup(request, env);
