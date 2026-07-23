import { beforeEach, describe, expect, it, vi } from 'vitest';
import mainSource from '../main.tsx?raw';

const {
  CloudflareVehicleRegistrationLookupMock,
  LookupVehicleRegistrationMock,
  SupabaseAccessTokenProviderMock,
  SupabaseVehicleRepositoryMock,
  VehicleUseCasesMock,
  authenticationController,
  getAuthenticationControllerMock,
  repository,
  registrationLookup,
  registrationLookupPort,
  tokenProvider,
  useCases,
} = vi.hoisted(() => {
  const controller = { getCurrentAppUser: vi.fn() };
  const repositoryInstance = { adapter: 'supabase-vehicle-repository' };
  const tokenProviderInstance = { adapter: 'supabase-access-token-provider' };
  const registrationLookupPortInstance = { adapter: 'cloudflare-registration-lookup' };
  const registrationLookupInstance = { feature: 'registration-lookup' };
  const useCaseInstance = { feature: 'vehicle-use-cases' };

  return {
    CloudflareVehicleRegistrationLookupMock: vi.fn(
      function CloudflareVehicleRegistrationLookupMock(tokenProviderArgument: unknown) {
        expect(tokenProviderArgument).toBe(tokenProviderInstance);
        return registrationLookupPortInstance;
      },
    ),
    LookupVehicleRegistrationMock: vi.fn(function LookupVehicleRegistrationMock(
      lookupPortArgument: unknown,
      currentUserSourceArgument: unknown,
    ) {
      expect(lookupPortArgument).toBe(registrationLookupPortInstance);
      expect(currentUserSourceArgument).toBe(controller);
      return registrationLookupInstance;
    }),
    SupabaseAccessTokenProviderMock: vi.fn(function SupabaseAccessTokenProviderMock() {
      return tokenProviderInstance;
    }),
    SupabaseVehicleRepositoryMock: vi.fn(function SupabaseVehicleRepositoryMock() {
      return repositoryInstance;
    }),
    VehicleUseCasesMock: vi.fn(function VehicleUseCasesMock(
      repositoryArgument: unknown,
      currentUserSourceArgument: unknown,
    ) {
      expect(repositoryArgument).toBe(repositoryInstance);
      expect(currentUserSourceArgument).toBe(controller);
      return useCaseInstance;
    }),
    authenticationController: controller,
    getAuthenticationControllerMock: vi.fn(() => controller),
    repository: repositoryInstance,
    registrationLookup: registrationLookupInstance,
    registrationLookupPort: registrationLookupPortInstance,
    tokenProvider: tokenProviderInstance,
    useCases: useCaseInstance,
  };
});

vi.mock('./authenticationComposition', () => ({
  getAuthenticationController: getAuthenticationControllerMock,
}));

vi.mock('../application/use-cases/vehicles/vehicleUseCases', () => ({
  VehicleUseCases: VehicleUseCasesMock,
}));

vi.mock('../application/use-cases/vehicles/lookupVehicleRegistration', () => ({
  LookupVehicleRegistration: LookupVehicleRegistrationMock,
}));

vi.mock('../infrastructure/cloudflare/CloudflareVehicleRegistrationLookup', () => ({
  CloudflareVehicleRegistrationLookup: CloudflareVehicleRegistrationLookupMock,
}));

vi.mock('../infrastructure/supabase/auth/SupabaseAccessTokenProvider', () => ({
  SupabaseAccessTokenProvider: SupabaseAccessTokenProviderMock,
}));

vi.mock('../infrastructure/supabase/repositories/SupabaseVehicleRepository', () => ({
  SupabaseVehicleRepository: SupabaseVehicleRepositoryMock,
}));

beforeEach(() => {
  vi.resetModules();
  SupabaseVehicleRepositoryMock.mockClear();
  SupabaseAccessTokenProviderMock.mockClear();
  CloudflareVehicleRegistrationLookupMock.mockClear();
  LookupVehicleRegistrationMock.mockClear();
  VehicleUseCasesMock.mockClear();
  getAuthenticationControllerMock.mockClear();
});

describe('Vehicle composition', () => {
  it('constructs nothing when imported', async () => {
    await import('./vehicleComposition');

    expect(SupabaseVehicleRepositoryMock).not.toHaveBeenCalled();
    expect(SupabaseAccessTokenProviderMock).not.toHaveBeenCalled();
    expect(CloudflareVehicleRegistrationLookupMock).not.toHaveBeenCalled();
    expect(LookupVehicleRegistrationMock).not.toHaveBeenCalled();
    expect(VehicleUseCasesMock).not.toHaveBeenCalled();
    expect(getAuthenticationControllerMock).not.toHaveBeenCalled();
  });

  it('lazily composes and reuses the app-owned Vehicle use cases', async () => {
    const { getVehicleUseCases } = await import('./vehicleComposition');

    expect(getVehicleUseCases()).toBe(useCases);
    expect(getVehicleUseCases()).toBe(useCases);
    expect(SupabaseVehicleRepositoryMock).toHaveBeenCalledOnce();
    expect(getAuthenticationControllerMock).toHaveBeenCalledOnce();
    expect(VehicleUseCasesMock).toHaveBeenCalledOnce();
    expect(VehicleUseCasesMock).toHaveBeenCalledWith(
      repository,
      authenticationController,
    );
  });

  it('lazily composes the registration lookup with the Supabase token provider', async () => {
    const { getVehicleRegistrationLookup } = await import('./vehicleComposition');

    expect(getVehicleRegistrationLookup()).toBe(registrationLookup);
    expect(getVehicleRegistrationLookup()).toBe(registrationLookup);
    expect(SupabaseAccessTokenProviderMock).toHaveBeenCalledOnce();
    expect(CloudflareVehicleRegistrationLookupMock).toHaveBeenCalledOnce();
    expect(CloudflareVehicleRegistrationLookupMock).toHaveBeenCalledWith(tokenProvider);
    expect(LookupVehicleRegistrationMock).toHaveBeenCalledOnce();
    expect(LookupVehicleRegistrationMock).toHaveBeenCalledWith(
      registrationLookupPort,
      authenticationController,
    );
  });

  it('keeps concrete Vehicle repository construction at app composition boundaries', () => {
    const productionSources = import.meta.glob<string>(
      ['../**/*.ts', '../**/*.tsx'],
      { eager: true, import: 'default', query: '?raw' },
    );
    const constructionSites = Object.entries(productionSources)
      .filter(([path]) => !path.includes('.test.') && !path.includes('.contract.'))
      .filter(([, source]) => source.includes('new SupabaseVehicleRepository('))
      .map(([path]) => path);

    expect(constructionSites).toHaveLength(2);
    expect(constructionSites).toEqual(expect.arrayContaining([
      expect.stringMatching(/vehicleComposition\.ts$/u),
      expect.stringMatching(/serviceRecordComposition\.ts$/u),
    ]));
  });

  it('keeps Supabase client access inside the Supabase infrastructure boundary', () => {
    const productionSources = import.meta.glob<string>(
      ['../**/*.ts', '../**/*.tsx'],
      { eager: true, import: 'default', query: '?raw' },
    );
    const violations = Object.entries(productionSources)
      .filter(([path]) => !path.includes('.test.') && !path.includes('.contract.'))
      .filter(([path]) => !path.includes('/infrastructure/supabase/'))
      .filter(([, source]) => (
        source.includes('getSupabaseClient')
        || source.includes('@supabase/supabase-js')
      ))
      .map(([path]) => path);

    expect(violations).toEqual([]);
  });

  it('constructs the Supabase access-token provider only at the app boundary', () => {
    const productionSources = import.meta.glob<string>(
      ['../**/*.ts', '../**/*.tsx'],
      { eager: true, import: 'default', query: '?raw' },
    );
    const constructionSites = Object.entries(productionSources)
      .filter(([path]) => !path.includes('.test.') && !path.includes('.contract.'))
      .filter(([, source]) => source.includes('new SupabaseAccessTokenProvider('))
      .map(([path]) => path);

    expect(constructionSites).toHaveLength(1);
    expect(constructionSites[0]).toMatch(/vehicleComposition\.ts$/u);
  });

  it('mounts the injected Vehicle feature provider once at the app root', () => {
    expect(
      mainSource.match(/<VehicleProvider operations=\{getVehicleUseCases\(\)\}>/gu),
    ).toHaveLength(1);
  });
});
