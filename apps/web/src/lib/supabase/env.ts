import { isServiceRoleKey } from "@yakila/api";

/**
 * Variables publiques de Supabase. Lues à l'appel (jamais à l'import) : `next build` doit
 * passer sans variables d'environnement (CI), l'erreur n'arrive qu'au moment d'une requête.
 *
 * Les accès `process.env.NEXT_PUBLIC_…` doivent rester littéraux : Next les remplace à la
 * compilation dans le bundle navigateur, une lecture dynamique (`process.env[name]`) échouerait.
 * `isServiceRoleKey` (partagé, `@yakila/api`) refuse une clé service role qui serait rendue publique.
 */

/**
 * Options des cookies de session, identiques pour les trois clients (navigateur, serveur, proxy).
 * `@supabase/ssr` ne pose pas `Secure` par défaut : en production le cookie ne doit voyager qu'en
 * HTTPS. En développement (http://localhost) on ne l'impose pas : Safari refuse un cookie `Secure` sur http.
 * `process.env.NODE_ENV` reste littéral : Next le remplace à la compilation dans le bundle navigateur.
 */
export const SESSION_COOKIE_OPTIONS = { secure: process.env.NODE_ENV === "production" };

export function getSupabaseEnv(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Variables manquantes : NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY " +
        "doivent être définies (apps/web/.env.local en local).",
    );
  }
  if (isServiceRoleKey(anonKey)) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY contient une clé service role : elle serait publique. " +
        "Utilise la clé anon / publishable.",
    );
  }
  return { url, anonKey };
}
