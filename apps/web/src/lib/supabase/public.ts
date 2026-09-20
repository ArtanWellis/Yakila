import { createSupabaseClient } from "@yakila/api";
import { getSupabaseEnv } from "./env";

/**
 * Client anonyme, sans cookies ni session : pour les pages publiques (profils, plus tard services
 * et annonces). Le rendu ne dépend alors pas du visiteur, ce qui garantit qu'aucune donnée privée
 * n'y fuit et laisse la porte ouverte à la mise en cache. `createSupabaseClient` refuse aussi
 * une clé service role.
 */
export function createPublicSupabaseClient() {
  const { url, anonKey } = getSupabaseEnv();
  return createSupabaseClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
