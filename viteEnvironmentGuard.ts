import { validateSupabaseBrowserConfig } from './src/shared/config/supabaseBrowserConfigValidation';

type BuildEnvironment = Readonly<Record<string, string | undefined>>;

const APPROVED_PUBLIC_ENVIRONMENT_NAMES = new Set([
  'VITE_SUPABASE_PUBLISHABLE_KEY',
  'VITE_SUPABASE_URL',
]);

export function assertOnlyApprovedPublicEnvironment(
  environment: BuildEnvironment,
): void {
  const hasUnapprovedPublicVariable = Object.keys(environment).some((name) => (
    name.startsWith('VITE_') && !APPROVED_PUBLIC_ENVIRONMENT_NAMES.has(name)
  ));

  if (hasUnapprovedPublicVariable) {
    throw new Error('Unsupported public environment variable is configured.');
  }

  const hasSupabasePublicConfiguration = environment.VITE_SUPABASE_URL !== undefined
    || environment.VITE_SUPABASE_PUBLISHABLE_KEY !== undefined;

  if (hasSupabasePublicConfiguration) {
    validateSupabaseBrowserConfig(environment);
  }
}

export function removeLocalDevelopmentSecretsFromBuildOutput(
  buildOutput: Record<string, unknown>,
): void {
  delete buildOutput['.dev.vars'];
}
