import { describe, expect, it } from 'vitest';
import {
  isVehicleRegistrationSuggestion,
  normalizeRegistrationForLookup,
  validateRegistrationLookupInput,
} from './registrationLookup';

describe('registration lookup input', () => {
  it('normalizes only the upstream registration representation', () => {
    expect(normalizeRegistrationForLookup(' wa- 123 ab ')).toBe('WA123AB');
  });

  it('accepts every supported Australian registration state', () => {
    for (const registrationState of ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA']) {
      expect(validateRegistrationLookupInput({ registration: 'ABC 123', registrationState }))
        .toEqual({ registration: 'ABC 123', registrationState });
    }
  });

  it('rejects missing state, extra fields, and overlong registrations', () => {
    expect(validateRegistrationLookupInput({ registration: 'ABC 123', registrationState: '' })).toBeNull();
    expect(validateRegistrationLookupInput({ registration: 'A'.repeat(51), registrationState: 'WA' })).toBeNull();
    expect(validateRegistrationLookupInput({ registration: 'ABC', registrationState: 'WA', vin: 'private' })).toBeNull();
  });
});

describe('Vehicle registration suggestions', () => {
  it('accepts the normalized app-owned suggestion fields', () => {
    expect(isVehicleRegistrationSuggestion({
      make: 'Ferrari',
      model: 'Roma',
      year: '2018-2021',
      engine: 'V8',
      body: 'Coupe',
      detailedDescription: 'A detailed Vehicle description.',
      registrationState: 'WA',
    })).toBe(true);
  });

  it.each([
    ['numeric Year', { year: 2021, registrationState: 'WA' }],
    ['blank Body', { body: '   ', registrationState: 'WA' }],
    ['unnormalized Body', { body: ' Coupe ', registrationState: 'WA' }],
    ['mistyped detailed description', { detailedDescription: 123, registrationState: 'WA' }],
    ['overlong Year', { year: 'Y'.repeat(51), registrationState: 'WA' }],
    ['overlong Body', { body: 'B'.repeat(51), registrationState: 'WA' }],
    [
      'overlong detailed description',
      { detailedDescription: 'D'.repeat(501), registrationState: 'WA' },
    ],
    ['provider-specific field', { year_range: '2018-2021', registrationState: 'WA' }],
    ['unknown field', { source: 'provider', registrationState: 'WA' }],
  ])('rejects %s at the browser response boundary', (_, suggestion) => {
    expect(isVehicleRegistrationSuggestion(suggestion)).toBe(false);
  });
});
