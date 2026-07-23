import { describe, expect, it, vi } from 'vitest';
import { SupabaseAuthenticationSessionEvents } from './SupabaseAuthenticationSessionEvents';

describe('SupabaseAuthenticationSessionEvents', () => {
  it('forwards only recoverable session events and cleans up', () => {
    let authStateListener: ((event: string, session: unknown) => void) | undefined;
    const unsubscribe = vi.fn();
    const onAuthStateChange = vi.fn((listener: (event: string, session: unknown) => void) => {
      authStateListener = listener;

      return { data: { subscription: { unsubscribe } } };
    });
    const events = new SupabaseAuthenticationSessionEvents({
      auth: { onAuthStateChange },
    });
    const listener = vi.fn();
    const stop = events.subscribe(listener);

    authStateListener?.('INITIAL_SESSION', null);
    authStateListener?.('PASSWORD_RECOVERY', null);
    expect(listener).not.toHaveBeenCalled();

    for (const event of [
      'SIGNED_IN',
      'SIGNED_OUT',
      'TOKEN_REFRESHED',
      'USER_UPDATED',
    ]) {
      authStateListener?.(event, { access_token: 'provider-private' });
    }

    expect(onAuthStateChange).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenNthCalledWith(1, { type: 'session_changed' });
    expect(listener).toHaveBeenNthCalledWith(2, { type: 'access_lost' });
    expect(listener).toHaveBeenNthCalledWith(3, { type: 'session_changed' });
    expect(listener).toHaveBeenNthCalledWith(4, { type: 'session_changed' });

    stop();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});
