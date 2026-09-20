import { createClient, type SupabaseClientOptions } from "@supabase/supabase-js";
import type { Database } from "@yakila/types";

import { isServiceRoleKey } from "./keys";

export * from "./profiles";
export { isServiceRoleKey } from "./keys";

/**
 * Client Supabase typé pour le web et le mobile. N'accepte que la clé anon : la service role
 * key ne doit jamais atteindre un client, on refuse donc de la construire.
 *
 * `options` sert au mobile, qui passe son stockage sécurisé :
 * `{ auth: { storage: secureStoreAdapter, detectSessionInUrl: false } }`.
 */
export function createSupabaseClient(
  url: string,
  anonKey: string,
  options?: SupabaseClientOptions<"public">,
) {
  if (isServiceRoleKey(anonKey)) {
    throw new Error("Clé service role refusée : un client n'accepte que la clé anon.");
  }
  return createClient<Database>(url, anonKey, options);
}

export type SupabaseClient = ReturnType<typeof createSupabaseClient>;
