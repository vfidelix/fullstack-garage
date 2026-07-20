import { describe, expect, it, vi } from 'vitest';
import { SupabaseAuthenticationSessionEvents } from './SupabaseAuthenticationSessionEvents';

describe('SupabaseAuthenticationSessionEvents', () => {
  it('forwards only recoverable session events and cleans up', () => {
    let authStateListener: ((event: string) => void) | undefined;
    const unsubscribe = vi.fn();
    const onAuthStateChange = vi.fn((listener: (event: string) => void) => {
      authStateListener = listener;

      return { data: { subscription: { unsubscribe } } };
    });
    const events = new SupabaseAuthenticationSessionEvents({
      auth: { onAuthStateChange },
    });
    const listener = vi.fn();
    const stop = events.subscribe(listener);

    authStateListener?.('INITIAL_SESSION');
    authStateListener?.('PASSWORD_RECOVERY');
    expect(listener).not.toHaveBeenCalled();

    for (const event of [
      'SIGNED_IN',
      'SIGNED_OUT',
      'TOKEN_REFRESHED',
      'USER_UPDATED',
    ]) {
      authStateListener?.(event);
    }

    expect(onAuthStateChange).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledTimes(4);

    stop();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});
