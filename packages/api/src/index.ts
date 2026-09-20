import { createClient } from "@supabase/supabase-js";

/**
 * Client Supabase pour le web et le mobile. N'accepte que la clé anon :
 * la service role key ne doit jamais atteindre un client.
 */
export function createSupabaseClient(url: string, anonKey: string) {
  return createClient(url, anonKey);
}

export type SupabaseClient = ReturnType<typeof createSupabaseClient>;
