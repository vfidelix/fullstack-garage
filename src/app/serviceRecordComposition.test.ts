import { beforeEach, describe, expect, it, vi } from 'vitest';
import mainSource from '../main.tsx?raw';

const {
  JsPdfServiceRecordRendererMock,
  ServiceRecordUseCasesMock,
  SupabaseServiceRecordRepositoryMock,
  SupabaseServiceRecordSnapshotRepositoryMock,
  SupabaseVehicleRepositoryMock,
  authenticationController,
  getAuthenticationControllerMock,
  records,
  renderer,
  snapshots,
  vehicles,
  useCases,
} = vi.hoisted(() => {
  const controller = { getCurrentAppUser: vi.fn() };
  const recordRepository = { adapter: 'supabase-service-record-repository' };
  const snapshotRepository = { adapter: 'supabase-service-record-snapshot-repository' };
  const vehicleRepository = { adapter: 'supabase-vehicle-repository' };
  const pdfRenderer = { adapter: 'jspdf-service-record-renderer' };
  const useCaseInstance = { feature: 'service-record-use-cases' };

  return {
    JsPdfServiceRecordRendererMock: vi.fn(function JsPdfServiceRecordRendererMock() {
      return pdfRenderer;
    }),
    ServiceRecordUseCasesMock: vi.fn(function ServiceRecordUseCasesMock(
      recordsArgument: unknown,
      vehiclesArgument: unknown,
      snapshotsArgument: unknown,
      rendererArgument: unknown,
      currentUserSourceArgument: unknown,
      snapshotSourceArgument: unknown,
    ) {
      expect(recordsArgument).toBe(recordRepository);
      expect(vehiclesArgument).toBe(vehicleRepository);
      expect(snapshotsArgument).toBe(snapshotRepository);
      expect(rendererArgument).toBe(pdfRenderer);
      expect(currentUserSourceArgument).toBe(controller);
      const snapshotSource = snapshotSourceArgument as {
        readonly createId?: unknown;
        readonly now?: unknown;
      };
      expect(typeof snapshotSource.createId).toBe('function');
      expect(typeof snapshotSource.now).toBe('function');
      return useCaseInstance;
    }),
    SupabaseServiceRecordRepositoryMock: vi.fn(
      function SupabaseServiceRecordRepositoryMock() {
        return recordRepository;
      },
    ),
    SupabaseServiceRecordSnapshotRepositoryMock: vi.fn(
      function SupabaseServiceRecordSnapshotRepositoryMock() {
        return snapshotRepository;
      },
    ),
    SupabaseVehicleRepositoryMock: vi.fn(function SupabaseVehicleRepositoryMock() {
      return vehicleRepository;
    }),
    authenticationController: controller,
    getAuthenticationControllerMock: vi.fn(() => controller),
    records: recordRepository,
    renderer: pdfRenderer,
    snapshots: snapshotRepository,
    vehicles: vehicleRepository,
    useCases: useCaseInstance,
  };
});

vi.mock('./authenticationComposition', () => ({
  getAuthenticationController: getAuthenticationControllerMock,
}));
vi.mock('../application/use-cases/service-records/serviceRecordUseCases', () => ({
  ServiceRecordUseCases: ServiceRecordUseCasesMock,
}));
vi.mock('../infrastructure/pdf/JsPdfServiceRecordRenderer', () => ({
  JsPdfServiceRecordRenderer: JsPdfServiceRecordRendererMock,
}));
vi.mock('../infrastructure/supabase/repositories/SupabaseServiceRecordRepository', () => ({
  SupabaseServiceRecordRepository: SupabaseServiceRecordRepositoryMock,
}));
vi.mock('../infrastructure/supabase/repositories/SupabaseServiceRecordSnapshotRepository', () => ({
  SupabaseServiceRecordSnapshotRepository: SupabaseServiceRecordSnapshotRepositoryMock,
}));
vi.mock('../infrastructure/supabase/repositories/SupabaseVehicleRepository', () => ({
  SupabaseVehicleRepository: SupabaseVehicleRepositoryMock,
}));

beforeEach(() => {
  vi.resetModules();
  JsPdfServiceRecordRendererMock.mockClear();
  ServiceRecordUseCasesMock.mockClear();
  SupabaseServiceRecordRepositoryMock.mockClear();
  SupabaseServiceRecordSnapshotRepositoryMock.mockClear();
  SupabaseVehicleRepositoryMock.mockClear();
  getAuthenticationControllerMock.mockClear();
});

describe('Service Record composition', () => {
  it('mounts the injected Service Record provider once at the app root', () => {
    expect(
      mainSource.match(/<ServiceRecordProvider operations=\{getServiceRecordUseCases\(\)\}>/gu),
    ).toHaveLength(1);
  });

  it('lazily composes and reuses app-owned Service Record use cases', async () => {
    const { getServiceRecordUseCases } = await import('./serviceRecordComposition');

    expect(getServiceRecordUseCases()).toBe(useCases);
    expect(getServiceRecordUseCases()).toBe(useCases);
    expect(SupabaseServiceRecordRepositoryMock).toHaveBeenCalledOnce();
    expect(SupabaseServiceRecordSnapshotRepositoryMock).toHaveBeenCalledOnce();
    expect(SupabaseVehicleRepositoryMock).toHaveBeenCalledOnce();
    expect(JsPdfServiceRecordRendererMock).toHaveBeenCalledOnce();
    expect(getAuthenticationControllerMock).toHaveBeenCalledOnce();
    expect(ServiceRecordUseCasesMock).toHaveBeenCalledOnce();
    expect(authenticationController).toBeDefined();
    expect(records).toBeDefined();
    expect(snapshots).toBeDefined();
    expect(vehicles).toBeDefined();
    expect(renderer).toBeDefined();
  });
});
