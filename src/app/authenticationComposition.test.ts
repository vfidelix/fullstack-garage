import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  AuthenticationControllerMock,
  PrivateStateCleanupRegistryMock,
  SupabaseAuthGatewayMock,
  SupabaseAuthenticationSessionEventsMock,
  controllerInstance,
  gatewayInstance,
  registryInstance,
  sessionEventsInstance,
} = vi.hoisted(() => {
  const gateway = { adapter: 'supabase-gateway' };
  const controller = { workflow: 'authentication-controller' };
  const registry = { cleanups: 'private-state-registry' };
  const sessionEvents = { events: 'supabase-session-events' };

  return {
    AuthenticationControllerMock: vi.fn(function AuthenticationControllerMock(
      gatewayArgument: unknown,
      registryArgument: unknown,
    ) {
      expect(gatewayArgument).toBe(gateway);
      expect(registryArgument).toBe(registry);
      return controller;
    }),
    PrivateStateCleanupRegistryMock: vi.fn(
      function PrivateStateCleanupRegistryMock() {
        return registry;
      },
    ),
    SupabaseAuthGatewayMock: vi.fn(function SupabaseAuthGatewayMock() {
      return gateway;
    }),
    SupabaseAuthenticationSessionEventsMock: vi.fn(
      function SupabaseAuthenticationSessionEventsMock() {
        return sessionEvents;
      },
    ),
    controllerInstance: controller,
    gatewayInstance: gateway,
    registryInstance: registry,
    sessionEventsInstance: sessionEvents,
  };
});

vi.mock('../application/use-cases/auth/authenticationController', () => ({
  AuthenticationController: AuthenticationControllerMock,
}));

vi.mock('../application/authentication/privateStateCleanupRegistry', () => ({
  PrivateStateCleanupRegistry: PrivateStateCleanupRegistryMock,
}));

vi.mock('../infrastructure/supabase/auth/SupabaseAuthGateway', () => ({
  SupabaseAuthGateway: SupabaseAuthGatewayMock,
}));

vi.mock('../infrastructure/supabase/auth/SupabaseAuthenticationSessionEvents', () => ({
  SupabaseAuthenticationSessionEvents: SupabaseAuthenticationSessionEventsMock,
}));

beforeEach(() => {
  vi.resetModules();
  AuthenticationControllerMock.mockClear();
  PrivateStateCleanupRegistryMock.mockClear();
  SupabaseAuthGatewayMock.mockClear();
  SupabaseAuthenticationSessionEventsMock.mockClear();
});

describe('authentication composition', () => {
  it('does not construct the gateway or controller when imported', async () => {
    await import('./authenticationComposition');

    expect(SupabaseAuthGatewayMock).not.toHaveBeenCalled();
    expect(SupabaseAuthenticationSessionEventsMock).not.toHaveBeenCalled();
    expect(AuthenticationControllerMock).not.toHaveBeenCalled();
    expect(PrivateStateCleanupRegistryMock).not.toHaveBeenCalled();
  });

  it('injects one Supabase gateway into one authentication controller', async () => {
    const { getAuthenticationController } = await import('./authenticationComposition');

    expect(getAuthenticationController()).toBe(controllerInstance);
    expect(SupabaseAuthGatewayMock).toHaveBeenCalledOnce();
    expect(AuthenticationControllerMock).toHaveBeenCalledOnce();
    expect(PrivateStateCleanupRegistryMock).toHaveBeenCalledOnce();
    expect(AuthenticationControllerMock).toHaveBeenCalledWith(
      gatewayInstance,
      registryInstance,
    );
  });

  it('reuses the composed authentication controller', async () => {
    const { getAuthenticationController } = await import('./authenticationComposition');

    const firstController = getAuthenticationController();
    const secondController = getAuthenticationController();

    expect(secondController).toBe(firstController);
    expect(SupabaseAuthGatewayMock).toHaveBeenCalledOnce();
    expect(AuthenticationControllerMock).toHaveBeenCalledOnce();
  });

  it('lazily composes and reuses the provider-neutral session event source', async () => {
    const { getAuthenticationSessionEvents } = await import('./authenticationComposition');

    const firstEvents = getAuthenticationSessionEvents();
    const secondEvents = getAuthenticationSessionEvents();

    expect(firstEvents).toBe(sessionEventsInstance);
    expect(secondEvents).toBe(firstEvents);
    expect(SupabaseAuthenticationSessionEventsMock).toHaveBeenCalledOnce();
  });

  it('keeps concrete gateway construction in this composition module only', () => {
    const productionSources = import.meta.glob<string>(
      ['../**/*.ts', '../**/*.tsx'],
      { eager: true, import: 'default', query: '?raw' },
    );
    const constructionSites = Object.entries(productionSources)
      .filter(([path]) => !path.includes('.test.') && !path.includes('.contract.'))
      .filter(([, source]) => source.includes('new SupabaseAuthGateway('))
      .map(([path]) => path);

    expect(constructionSites).toHaveLength(1);
    expect(constructionSites[0]).toMatch(/authenticationComposition\.ts$/u);
  });

  it('keeps concrete session event construction in composition only', () => {
    const productionSources = import.meta.glob<string>(
      ['../**/*.ts', '../**/*.tsx'],
      { eager: true, import: 'default', query: '?raw' },
    );
    const constructionSites = Object.entries(productionSources)
      .filter(([path]) => !path.includes('.test.') && !path.includes('.contract.'))
      .filter(([, source]) => (
        source.includes('new SupabaseAuthenticationSessionEvents(')
      ))
      .map(([path]) => path);

    expect(constructionSites).toHaveLength(1);
    expect(constructionSites[0]).toMatch(/authenticationComposition\.ts$/u);
  });
});
