export type AuthenticationErrorCategory
  = | 'sign_in_cancelled'
    | 'sign_in_unavailable'
    | 'invalid_callback'
    | 'session_expired'
    | 'provisioning_failed'
    | 'sign_out_failed'
    | 'unexpected';

export interface AuthenticationError {
  readonly category: AuthenticationErrorCategory;
  readonly message: string;
}

const authenticationErrorMessages: Readonly<
  Record<AuthenticationErrorCategory, string>
> = {
  sign_in_cancelled: 'Sign-in was cancelled.',
  sign_in_unavailable: 'Google sign-in is temporarily unavailable. Please try again.',
  invalid_callback: 'The sign-in link is invalid or has expired. Please try again.',
  session_expired: 'Your session has expired. Please sign in again.',
  provisioning_failed: 'Your Fullstack Garage access could not be verified. Please try again.',
  sign_out_failed: 'Fullstack Garage could not sign you out. Please try again.',
  unexpected: 'Authentication is temporarily unavailable. Please try again.',
};

export function createAuthenticationError(
  category: AuthenticationErrorCategory,
): AuthenticationError {
  return {
    category,
    message: authenticationErrorMessages[category],
  };
}
