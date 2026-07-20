import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createClientMock, getSupabaseBrowserConfigMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  getSupabaseBrowserConfigMock: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock,
}));

vi.mock('../../shared/config/supabaseConfig', () => ({
  getSupabaseBrowserConfig: getSupabaseBrowserConfigMock,
}));

describe('getSupabaseClient', () => {
  beforeEach(() => {
    vi.resetModules();
    createClientMock.mockReset();
    getSupabaseBrowserConfigMock.mockReset();
  });

  it('does not read configuration or create a client when imported', async () => {
    await import('./client');

    expect(getSupabaseBrowserConfigMock).not.toHaveBeenCalled();
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it('forwards validated browser configuration without overriding auth defaults', async () => {
    const client = { auth: {} };
    getSupabaseBrowserConfigMock.mockReturnValue({
      url: 'https://project-ref.supabase.co',
      publishableKey: 'sb_publishable_1234567890abcdef',
    });
    createClientMock.mockReturnValue(client);
    const { getSupabaseClient } = await import('./client');

    expect(getSupabaseClient()).toBe(client);
    expect(getSupabaseBrowserConfigMock).toHaveBeenCalledOnce();
    expect(createClientMock).toHaveBeenCalledWith(
      'https://project-ref.supabase.co',
      'sb_publishable_1234567890abcdef',
    );
    expect(createClientMock.mock.calls[0]).toHaveLength(2);
  });

  it('reuses the same client instance', async () => {
    const client = { auth: {} };
    getSupabaseBrowserConfigMock.mockReturnValue({
      url: 'https://project-ref.supabase.co',
      publishableKey: 'sb_publishable_1234567890abcdef',
    });
    createClientMock.mockReturnValue(client);
    const { getSupabaseClient } = await import('./client');

    const firstClient = getSupabaseClient();
    const secondClient = getSupabaseClient();

    expect(secondClient).toBe(firstClient);
    expect(getSupabaseBrowserConfigMock).toHaveBeenCalledOnce();
    expect(createClientMock).toHaveBeenCalledOnce();
  });
});
