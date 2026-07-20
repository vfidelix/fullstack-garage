import { describe, expect, it, vi } from 'vitest';
import { PrivateStateCleanupRegistry } from './privateStateCleanupRegistry';

function createDeferred<T>(): {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
} {
  let resolvePromise: ((value: T) => void) | undefined;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });

  if (resolvePromise === undefined) {
    throw new Error('Deferred promise was not initialized.');
  }

  return { promise, resolve: resolvePromise };
}

describe('PrivateStateCleanupRegistry', () => {
  it('registers cleanup and unregisters it idempotently', async () => {
    const registry = new PrivateStateCleanupRegistry();
    const cleanup = vi.fn();
    const unregister = registry.register(cleanup);

    await registry.clear();
    expect(cleanup).toHaveBeenCalledOnce();

    unregister();
    unregister();
    await registry.clear();
    expect(cleanup).toHaveBeenCalledOnce();
  });

  it('awaits sync and async cleanup and continues after failures', async () => {
    const registry = new PrivateStateCleanupRegistry();
    const completed: string[] = [];
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    registry.register(() => {
      completed.push('sync');
    });
    registry.register(() => {
      throw new Error('private callback details');
    });
    registry.register(async () => {
      await Promise.resolve();
      completed.push('async');
    });

    await expect(registry.clear()).resolves.toBeUndefined();

    expect(completed).toEqual(['sync', 'async']);
    expect(consoleError).not.toHaveBeenCalled();
    expect(consoleLog).not.toHaveBeenCalled();
    consoleError.mockRestore();
    consoleLog.mockRestore();
  });

  it('tracks repeated callback registrations independently', async () => {
    const registry = new PrivateStateCleanupRegistry();
    const cleanup = vi.fn();
    const unregisterFirst = registry.register(cleanup);
    const unregisterSecond = registry.register(cleanup);

    unregisterFirst();
    await registry.clear();
    expect(cleanup).toHaveBeenCalledOnce();

    unregisterSecond();
    await registry.clear();
    expect(cleanup).toHaveBeenCalledOnce();
  });

  it('uses a stable registration snapshot for each clear epoch', async () => {
    const registry = new PrivateStateCleanupRegistry();
    const releaseCleanup = createDeferred<undefined>();
    const existingCleanup = vi.fn(() => releaseCleanup.promise);
    const addedCleanup = vi.fn();
    const unregisterExisting = registry.register(existingCleanup);

    const firstClear = registry.clear();
    await vi.waitFor(() => {
      expect(existingCleanup).toHaveBeenCalledOnce();
    });
    unregisterExisting();
    registry.register(addedCleanup);
    releaseCleanup.resolve(undefined);
    await firstClear;

    expect(existingCleanup).toHaveBeenCalledOnce();
    expect(addedCleanup).not.toHaveBeenCalled();

    await registry.clear();
    expect(existingCleanup).toHaveBeenCalledOnce();
    expect(addedCleanup).toHaveBeenCalledOnce();
  });
});
