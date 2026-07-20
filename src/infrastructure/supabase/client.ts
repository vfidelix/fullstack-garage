import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseBrowserConfig } from '../../shared/config/supabaseConfig';

let supabaseClient: SupabaseClient | undefined;

export function getSupabaseClient(): SupabaseClient {
  if (supabaseClient === undefined) {
    const config = getSupabaseBrowserConfig();

    supabaseClient = createClient(config.url, config.publishableKey);
  }

  return supabaseClient;
}
