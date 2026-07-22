import { describe, expect, it, vi } from 'vitest';
import {
  handleVehicleRegistrationLookup,
  type PlateApiProxyEnv,
} from '../functions/api/vehicle-registration-lookup';

const env: PlateApiProxyEnv = {
  PLATEAPI_API_KEY: 'test-key',
  SUPABASE_PUBLISHABLE_KEY: 'public-key',
  SUPABASE_URL: 'https://example.supabase.co',
};

function request(body: unknown, authorization = 'Bearer session-token'): Request {
  return new Request('https://garage.example/api/vehicle-registration-lookup', {
    method: 'POST', headers: { 'Authorization': authorization, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}

function authorizedProviderResponse(providerResponse: Response) {
  return vi.fn()
    .mockResolvedValueOnce(new Response('{}', { status: 200 }))
    .mockResolvedValueOnce(new Response('true', { status: 200 }))
    .mockResolvedValueOnce(providerResponse);
}

function stallUntilAborted(_input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const signal = init?.signal;
  if (signal === undefined || signal === null) {
    return Promise.reject(new Error('Expected a request abort signal.'));
  }

  return new Promise((_, reject) => {
    const rejectAsAborted = () => {
      reject(new DOMException('The request was aborted.', 'AbortError'));
    };
    if (signal.aborted) {
      rejectAsAborted();
      return;
    }
    signal.addEventListener('abort', rejectAsAborted, { once: true });
  });
}

describe('vehicle registration lookup proxy', () => {
  it.each([
    { registration: 'ABC', registrationState: 'WA', vin: 'private' },
    { registration: 'ABC', registrationState: 'WA', detailed: false },
  ])('rejects browser-controlled or unknown request fields before authorization', async (body) => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const result = await handleVehicleRegistrationLookup(request(body), env);
    expect(result.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports missing worker Supabase configuration as not configured', async () => {
    vi.useFakeTimers();
    try {
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);
      const result = await handleVehicleRegistrationLookup(
        request({ registration: 'ABC', registrationState: 'WA' }),
        { PLATEAPI_API_KEY: 'test-key' },
      );
      expect(result.status).toBe(503);
      expect(await result.json()).toEqual({ status: 'error', category: 'not_configured' });
      expect(fetchMock).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it.each([
    { phase: 'user verification', precedingResponses: [] },
    {
      phase: 'admin verification',
      precedingResponses: [new Response('{}', { status: 200 })],
    },
    {
      phase: 'provider lookup',
      precedingResponses: [
        new Response('{}', { status: 200 }),
        new Response('true', { status: 200 }),
      ],
    },
  ])('times out stalled $phase with the shared request signal', async ({ precedingResponses }) => {
    vi.useFakeTimers();
    try {
      const fetchMock = vi.fn<typeof fetch>();
      for (const precedingResponse of precedingResponses) {
        fetchMock.mockResolvedValueOnce(precedingResponse);
      }
      fetchMock.mockImplementation(stallUntilAborted);
      vi.stubGlobal('fetch', fetchMock);

      const resultPromise = handleVehicleRegistrationLookup(
        request({ registration: 'ABC', registrationState: 'WA' }),
        env,
      );
      await vi.advanceTimersByTimeAsync(0);

      expect(fetchMock).toHaveBeenCalledTimes(precedingResponses.length + 1);
      const signals = fetchMock.mock.calls.map(([, init]) => init?.signal);
      expect(signals.every((signal) => signal === signals[0])).toBe(true);

      await vi.advanceTimersByTimeAsync(8_000);

      const result = await resultPromise;
      expect(result.status).toBe(503);
      expect(await result.json()).toEqual({
        status: 'error',
        category: 'temporary_unavailable',
      });
      expect(signals[0]?.aborted).toBe(true);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('constructs a fixed detailed request and maps the primary plus alternatives in order', async () => {
    const fetchMock = authorizedProviderResponse(Response.json({
      success: true,
      vehicle: {
        make: ' Ferrari ',
        model: 'Roma',
        year_range: ' 2018-2021 ',
        lowest_year: 2018,
        highest_year: 2021,
        engine: 'V8',
        body: ' Coupe ',
        detailed_description: ' Detailed primary description. ',
        registration_state: 'NSW',
        future_provider_field: 'ignored',
      },
      alternatives: [
        {
          make: 'Ferrari',
          model: 'Roma Spider',
          year_range: '2022',
          body: 'Convertible',
          detailed_description: 'Alternative description.',
        },
        {
          make: 'Ferrari',
          model: 'Roma',
          lowest_year: 2020,
          highest_year: 2020,
        },
      ],
      future_top_level_field: 'ignored',
    }));
    vi.stubGlobal('fetch', fetchMock);
    const result = await handleVehicleRegistrationLookup(request({ registration: 'ab- 123', registrationState: 'WA' }), env);
    expect(await result.json()).toEqual({
      status: 'found',
      suggestions: [
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
          detailedDescription: 'Alternative description.',
          registrationState: 'WA',
        },
        {
          make: 'Ferrari',
          model: 'Roma',
          year: '2020',
          registrationState: 'WA',
        },
      ],
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      new URL('https://api.plateapi.com.au/api/v1/lookup?plate=AB123&state=WA&detailed=true'),
      expect.anything(),
    );
  });

  it('uses equal exact-year bounds only when year_range is absent and omits unequal bounds', async () => {
    const exactFetch = authorizedProviderResponse(Response.json({
      success: true,
      vehicle: { lowest_year: 2021, highest_year: 2021 },
    }));
    vi.stubGlobal('fetch', exactFetch);
    expect(await (await handleVehicleRegistrationLookup(
      request({ registration: 'ABC', registrationState: 'WA' }),
      env,
    )).json()).toEqual({
      status: 'found',
      suggestions: [{ year: '2021', registrationState: 'WA' }],
    });

    const rangeFetch = authorizedProviderResponse(Response.json({
      success: true,
      vehicle: { lowest_year: 2018, highest_year: 2021 },
    }));
    vi.stubGlobal('fetch', rangeFetch);
    expect(await (await handleVehicleRegistrationLookup(
      request({ registration: 'ABC', registrationState: 'WA' }),
      env,
    )).json()).toEqual({
      status: 'found',
      suggestions: [{ registrationState: 'WA' }],
    });
  });

  it('omits blank or null optional provider fields instead of failing lookup', async () => {
    const fetchMock = authorizedProviderResponse(Response.json({
      success: true,
      vehicle: {
        make: 'Ferrari',
        model: '',
        year_range: '   ',
        lowest_year: null,
        highest_year: null,
        engine: null,
        body: '   ',
        detailed_description: '',
      },
      alternatives: [
        {
          make: null,
          model: 'Roma',
          detailed_description: null,
        },
      ],
    }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await handleVehicleRegistrationLookup(
      request({ registration: 'ABC', registrationState: 'WA' }),
      env,
    );

    expect(result.status).toBe(200);
    expect(await result.json()).toEqual({
      status: 'found',
      suggestions: [
        { make: 'Ferrari', registrationState: 'WA' },
        { model: 'Roma', registrationState: 'WA' },
      ],
    });
  });

  it.each([
    ['mistyped Make', { make: 123 }],
    ['mistyped year_range', { year_range: 2021 }],
    ['overlong year_range', { year_range: 'Y'.repeat(51) }],
    ['mistyped Body', { body: [] }],
    ['overlong Body', { body: 'B'.repeat(51) }],
    ['mistyped detailed description', { detailed_description: false }],
    ['overlong detailed description', { detailed_description: 'D'.repeat(501) }],
    ['mistyped exact-year bound', { lowest_year: '2021', highest_year: 2021 }],
    ['out-of-range exact-year bound', { lowest_year: 1899, highest_year: 1899 }],
    ['missing exact-year bound', { lowest_year: 2021 }],
  ])('rejects a provider suggestion with %s', async (_, vehicle) => {
    const fetchMock = authorizedProviderResponse(Response.json({ success: true, vehicle }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await handleVehicleRegistrationLookup(
      request({ registration: 'ABC', registrationState: 'WA' }),
      env,
    );

    expect(result.status).toBe(503);
    expect(await result.json()).toEqual({
      status: 'error',
      category: 'temporary_unavailable',
    });
  });

  it('maps provider no-match and rate limits without provider details', async () => {
    const noMatchFetch = authorizedProviderResponse(
      Response.json({ success: false, code: 'not_found' }),
    );
    vi.stubGlobal('fetch', noMatchFetch);
    expect(await (await handleVehicleRegistrationLookup(request({ registration: 'ABC', registrationState: 'WA' }), env)).json()).toEqual({ status: 'no_match' });

    const rateFetch = authorizedProviderResponse(
      new Response('', { status: 429, headers: { 'Retry-After': '60' } }),
    );
    vi.stubGlobal('fetch', rateFetch);
    expect(await (await handleVehicleRegistrationLookup(request({ registration: 'ABC', registrationState: 'WA' }), env)).json()).toEqual({ status: 'error', category: 'rate_limited', retryAfterSeconds: 60 });
  });
});
