import { describe, expect, it, vi } from 'vitest';
import {
  createAppQueryClient,
  getAppQueryClient,
} from './queryClientComposition';

describe('query client composition', () => {
  it('creates fresh clients for deterministic tests', () => {
    const firstClient = createAppQueryClient();
    const secondClient = createAppQueryClient();

    expect(secondClient).not.toBe(firstClient);
  });

  it('reuses one production query client', () => {
    expect(getAppQueryClient()).toBe(getAppQueryClient());
  });

  it('disables automatic retries and background refetches', () => {
    const defaultOptions = createAppQueryClient().getDefaultOptions();

    expect(defaultOptions.queries).toMatchObject({
      refetchOnReconnect: false,
      refetchOnWindowFocus: false,
      retry: false,
    });
    expect(defaultOptions.mutations).toMatchObject({ retry: false });
  });

  it('removes inactive query data immediately', async () => {
    const client = createAppQueryClient();
    const privateQueryKey = ['private-vehicle', 'synthetic-id'] as const;

    client.setQueryData(privateQueryKey, {
      registration: 'SYNTHETIC-PRIVATE-REGISTRATION',
    });

    await vi.waitFor(() => {
      expect(client.getQueryData(privateQueryKey)).toBeUndefined();
    });
  });

  it('attempts a failed query only once', async () => {
    const client = createAppQueryClient();
    const query = vi.fn().mockRejectedValue(new Error('Safe failure'));

    await expect(client.fetchQuery({
      queryFn: query,
      queryKey: ['failed-query'],
    })).rejects.toThrow('Safe failure');

    expect(query).toHaveBeenCalledOnce();
  });
});
