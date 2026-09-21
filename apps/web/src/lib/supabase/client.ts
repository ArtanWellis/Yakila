import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@yakila/types";
import { getSupabaseEnv, SESSION_COOKIE_OPTIONS } from "./env";

/**
 * Client Supabase du navigateur (Client Components uniquement). La session est lue et écrite dans
 * les cookies, donc partagée avec le serveur. `@supabase/ssr` en garde une seule instance côté navigateur.
 */
export function createBrowserSupabaseClient() {
  const { url, anonKey } = getSupabaseEnv();
  return createBrowserClient<Database>(url, anonKey, { cookieOptions: SESSION_COOKIE_OPTIONS });
}
