import {
  validateSupabaseBrowserConfig,
  type SupabaseBrowserConfig,
} from './supabaseBrowserConfigValidation';

export type { SupabaseBrowserConfig } from './supabaseBrowserConfigValidation';

type BrowserEnvironment = Readonly<Record<string, unknown>>;

function readBrowserEnvironment(): BrowserEnvironment {
  return {
    VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  };
}

export function getSupabaseBrowserConfig(
  environment: BrowserEnvironment = readBrowserEnvironment(),
): SupabaseBrowserConfig {
  return validateSupabaseBrowserConfig(environment);
}
