import type { AuthenticationSessionEvents } from '../../../application/ports/authenticationSessionEvents';
import { getSupabaseClient } from '../client';

interface SessionEventClient {
  readonly auth: {
    onAuthStateChange(callback: (event: string) => void): {
      readonly data: {
        readonly subscription: { unsubscribe(): void };
      };
    };
  };
}

const RECOVERABLE_SESSION_EVENTS = new Set([
  'SIGNED_IN',
  'SIGNED_OUT',
  'TOKEN_REFRESHED',
  'USER_UPDATED',
]);

export class SupabaseAuthenticationSessionEvents implements AuthenticationSessionEvents {
  public constructor(
    private readonly client: SessionEventClient = getSupabaseClient(),
  ) {}

  public subscribe(listener: () => void): () => void {
    const { data } = this.client.auth.onAuthStateChange((event) => {
      if (RECOVERABLE_SESSION_EVENTS.has(event)) {
        listener();
      }
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }
}
