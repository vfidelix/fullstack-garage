import { beforeEach, describe, expect, it, vi } from 'vitest';
import mainSource from '../main.tsx?raw';

const {
  SupabaseVehicleRepositoryMock,
  VehicleUseCasesMock,
  authenticationController,
  getAuthenticationControllerMock,
  repository,
  useCases,
} = vi.hoisted(() => {
  const controller = { getCurrentAppUser: vi.fn() };
  const repositoryInstance = { adapter: 'supabase-vehicle-repository' };
  const useCaseInstance = { feature: 'vehicle-use-cases' };

  return {
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
    useCases: useCaseInstance,
  };
});

vi.mock('./authenticationComposition', () => ({
  getAuthenticationController: getAuthenticationControllerMock,
}));

vi.mock('../application/use-cases/vehicles/vehicleUseCases', () => ({
  VehicleUseCases: VehicleUseCasesMock,
}));

vi.mock('../infrastructure/supabase/repositories/SupabaseVehicleRepository', () => ({
  SupabaseVehicleRepository: SupabaseVehicleRepositoryMock,
}));

beforeEach(() => {
  vi.resetModules();
  SupabaseVehicleRepositoryMock.mockClear();
  VehicleUseCasesMock.mockClear();
  getAuthenticationControllerMock.mockClear();
});

describe('Vehicle composition', () => {
  it('constructs nothing when imported', async () => {
    await import('./vehicleComposition');

    expect(SupabaseVehicleRepositoryMock).not.toHaveBeenCalled();
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

  it('keeps concrete Vehicle repository construction at the app boundary', () => {
    const productionSources = import.meta.glob<string>(
      ['../**/*.ts', '../**/*.tsx'],
      { eager: true, import: 'default', query: '?raw' },
    );
    const constructionSites = Object.entries(productionSources)
      .filter(([path]) => !path.includes('.test.') && !path.includes('.contract.'))
      .filter(([, source]) => source.includes('new SupabaseVehicleRepository('))
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
