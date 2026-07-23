import type {
  AuthenticationSessionEvent,
  AuthenticationSessionEvents,
} from '../../../application/ports/authenticationSessionEvents';
import { getSupabaseClient } from '../client';

interface SessionEventClient {
  readonly auth: {
    onAuthStateChange(callback: (event: string, session: unknown) => void): {
      readonly data: {
        readonly subscription: { unsubscribe(): void };
      };
    };
  };
}

const SESSION_EVENT_TYPES: Readonly<Record<string, AuthenticationSessionEvent['type']>> = {
  SIGNED_IN: 'session_changed',
  SIGNED_OUT: 'access_lost',
  TOKEN_REFRESHED: 'session_changed',
  USER_UPDATED: 'session_changed',
};

export class SupabaseAuthenticationSessionEvents implements AuthenticationSessionEvents {
  public constructor(
    private readonly client: SessionEventClient = getSupabaseClient(),
  ) {}

  public subscribe(listener: (event: AuthenticationSessionEvent) => void): () => void {
    const { data } = this.client.auth.onAuthStateChange((event) => {
      const type = SESSION_EVENT_TYPES[event];
      if (type !== undefined) {
        listener({ type });
      }
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }
}
