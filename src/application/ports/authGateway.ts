import type { AuthenticationResult } from '../authentication/authenticationModels';

export interface AuthGateway {
  restore(): Promise<AuthenticationResult>;
  signInWithGoogle(returnPath?: string): Promise<void>;
  signOut(): Promise<void>;
}
