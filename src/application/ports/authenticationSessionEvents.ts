/** Provider-neutral reasons to reconcile the current authentication state. */
export type AuthenticationSessionEvent = { readonly type: 'session_changed' } | { readonly type: 'access_lost' };

export interface AuthenticationSessionEvents {
  subscribe(listener: (event: AuthenticationSessionEvent) => void): () => void;
}
