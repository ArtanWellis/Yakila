import { createServerClient } from "@supabase/ssr";
import type { Database } from "@yakila/types";
import { cookies } from "next/headers";
import { getSupabaseEnv, SESSION_COOKIE_OPTIONS } from "./env";

/**
 * Client Supabase serveur lié aux cookies de la requête (Server Components, Server Actions,
 * Route Handlers). Un nouveau client par requête : ne jamais le partager ni le mettre en module.
 *
 * `cookies()` est asynchrone depuis Next 15. Dans un Server Component on ne peut pas écrire de
 * cookie (`set` lève) : l'échec est ignoré car `src/proxy.ts` rafraîchit déjà la session avant le rendu.
 */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = getSupabaseEnv();

  return createServerClient<Database>(url, anonKey, {
    cookieOptions: SESSION_COOKIE_OPTIONS,
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Appel depuis un Server Component : le proxy s'en charge.
        }
      },
    },
  });
}
