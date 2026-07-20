import { describe, expect, it } from 'vitest';
import {
  createAuthenticationError,
  type AuthenticationErrorCategory,
} from './authenticationError';

const expectedMessages: Readonly<
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

describe('createAuthenticationError', () => {
  it.each(Object.entries(expectedMessages))(
    'creates UI-safe copy for %s',
    (category, message) => {
      expect(
        createAuthenticationError(category as AuthenticationErrorCategory),
      ).toEqual({ category, message });
    },
  );
});
