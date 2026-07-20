import type { AppUser } from '../../domain/users/appUser';
import type { AuthenticationError } from './authenticationError';

export type AuthenticationState
  = | { readonly status: 'initializing' }
    | { readonly status: 'unauthenticated' }
    | { readonly status: 'authenticated'; readonly user: AppUser }
    | { readonly status: 'unauthorized' }
    | { readonly status: 'error'; readonly error: AuthenticationError };

export type AuthenticationResult
  = | { readonly status: 'unauthenticated' }
    | { readonly status: 'unauthorized' }
    | { readonly status: 'authenticated'; readonly user: AppUser };
