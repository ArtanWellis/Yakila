import { createServerClient } from "@supabase/ssr";
import type { Database } from "@yakila/types";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "./env";

/**
 * Rafraîchit la session Supabase pour la requête en cours (appelé par `src/proxy.ts`).
 *
 * Pourquoi ici : un Server Component ne peut pas écrire de cookie. Si le jeton d'accès expire, seul
 * le proxy peut poser le nouveau cookie, à la fois sur la requête (pour le rendu qui suit) et sur la
 * réponse (pour le navigateur). Sans cela, l'utilisateur serait déconnecté au hasard.
 *
 * `getClaims()` vérifie la signature du JWT localement (clés asymétriques, JWKS mis en cache) et ne
 * rappelle le serveur Auth que pour rafraîchir un jeton proche de l'expiration. À préférer à
 * `getUser()` (un appel réseau par requête) pour les contrôles de routine.
 */
export async function updateSession(request: NextRequest) {
  const { url, anonKey } = getSupabaseEnv();
  const state = { response: NextResponse.next({ request }) };

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        state.response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          state.response.cookies.set(name, value, options);
        }
        // Empêche un CDN de mettre en cache une réponse qui porte des cookies de session.
        for (const [key, value] of Object.entries(headers)) state.response.headers.set(key, value);
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  return { response: state.response, isAuthenticated: Boolean(data?.claims.sub) };
}
