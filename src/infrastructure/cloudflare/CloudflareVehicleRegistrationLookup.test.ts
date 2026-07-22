import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccessTokenProvider } from '../../application/ports/accessTokenProvider';
import { CloudflareVehicleRegistrationLookup } from './CloudflareVehicleRegistrationLookup';

function availableAccessToken(): AccessTokenProvider {
  return {
    getAccessToken: vi.fn().mockResolvedValue({
      status: 'available',
      accessToken: 'session-token',
    }),
  };
}

async function lookupWithResponse(responseBody: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(Response.json(responseBody));
  vi.stubGlobal('fetch', fetchMock);

  const result = await new CloudflareVehicleRegistrationLookup(availableAccessToken()).lookup({
    registration: 'ABC 123',
    registrationState: 'WA',
  });

  return { fetchMock, result };
}

describe('CloudflareVehicleRegistrationLookup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps rejected access-token retrieval to a safe temporary error', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const lookup = new CloudflareVehicleRegistrationLookup({
      getAccessToken: vi.fn().mockRejectedValue(new Error('private vendor detail')),
    });

    await expect(lookup.lookup({
      registration: 'ABC 123',
      registrationState: 'WA',
    })).resolves.toEqual({ status: 'error', category: 'temporary_unavailable' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ['an absent session', { status: 'unauthenticated' } as const, 'unauthenticated'],
    [
      'a session retrieval failure',
      { status: 'temporary_unavailable' } as const,
      'temporary_unavailable',
    ],
  ])('maps %s without making a request', async (_, tokenResult, category) => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const lookup = new CloudflareVehicleRegistrationLookup({
      getAccessToken: vi.fn().mockResolvedValue(tokenResult),
    });

    await expect(lookup.lookup({
      registration: 'ABC 123',
      registrationState: 'WA',
    })).resolves.toEqual({ status: 'error', category });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('accepts only normalized app-owned suggestions and preserves their ordering', async () => {
    const suggestions = [
      {
        make: 'Ferrari',
        model: 'Roma',
        year: '2018-2021',
        engine: 'V8',
        body: 'Coupe',
        detailedDescription: 'Detailed primary description.',
        registrationState: 'WA',
      },
      {
        make: 'Ferrari',
        model: 'Roma Spider',
        year: '2022',
        body: 'Convertible',
        registrationState: 'WA',
      },
    ];

    const { fetchMock, result } = await lookupWithResponse({ status: 'found', suggestions });

    expect(result).toEqual({ status: 'found', suggestions });
    expect(fetchMock).toHaveBeenCalledWith('/api/vehicle-registration-lookup', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer session-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ registration: 'ABC 123', registrationState: 'WA' }),
    });
  });

  it.each([
    ['numeric Year', { year: 2021, registrationState: 'WA' }],
    ['blank Body', { body: '   ', registrationState: 'WA' }],
    ['overlong Body', { body: 'B'.repeat(51), registrationState: 'WA' }],
    [
      'overlong detailed description',
      { detailedDescription: 'D'.repeat(501), registrationState: 'WA' },
    ],
    ['provider year_range', { year_range: '2018-2021', registrationState: 'WA' }],
    [
      'provider detailed_description',
      { detailed_description: 'Provider text', registrationState: 'WA' },
    ],
    ['unknown suggestion data', { source: 'provider', registrationState: 'WA' }],
  ])('maps a response containing %s to a safe temporary error', async (_, suggestion) => {
    const { result } = await lookupWithResponse({ status: 'found', suggestions: [suggestion] });

    expect(result).toEqual({ status: 'error', category: 'temporary_unavailable' });
  });
});
