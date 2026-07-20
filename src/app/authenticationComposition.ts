import { AuthenticationController } from '../application/use-cases/auth/authenticationController';
import type { AuthenticationSessionEvents } from '../application/ports/authenticationSessionEvents';
import { PrivateStateCleanupRegistry } from '../application/authentication/privateStateCleanupRegistry';
import { SupabaseAuthGateway } from '../infrastructure/supabase/auth/SupabaseAuthGateway';
import { SupabaseAuthenticationSessionEvents } from '../infrastructure/supabase/auth/SupabaseAuthenticationSessionEvents';

let authenticationController: AuthenticationController | undefined;
let authenticationSessionEvents: AuthenticationSessionEvents | undefined;
let privateStateCleanupRegistry: PrivateStateCleanupRegistry | undefined;

export function getAuthenticationController(): AuthenticationController {
  authenticationController ??= new AuthenticationController(
    new SupabaseAuthGateway(),
    privateStateCleanupRegistry ??= new PrivateStateCleanupRegistry(),
  );

  return authenticationController;
}

export function getAuthenticationSessionEvents(): AuthenticationSessionEvents {
  authenticationSessionEvents ??= new SupabaseAuthenticationSessionEvents();

  return authenticationSessionEvents;
}
