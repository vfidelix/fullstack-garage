/**
 * Clears one feature's private state during an authentication transition.
 * Cleanup must not invoke or await authentication-controller operations because
 * those operations may be waiting on the same non-reentrant cleanup barrier.
 */
export type PrivateStateCleanup = () => void | Promise<void>;
export type UnregisterPrivateStateCleanup = () => void;

export class PrivateStateCleanupRegistry {
  private readonly registrations = new Set<PrivateStateCleanup>();

  public register(
    cleanup: PrivateStateCleanup,
  ): UnregisterPrivateStateCleanup {
    const registration = () => cleanup();
    this.registrations.add(registration);

    return () => {
      this.registrations.delete(registration);
    };
  }

  public async clear(): Promise<void> {
    const results = Array.from(
      this.registrations,
      (cleanup) => Promise.resolve().then(cleanup),
    );

    await Promise.allSettled(results);
  }
}
