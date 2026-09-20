/**
 * Variables publiques de Supabase. Lues à l'appel (jamais à l'import) : `next build` doit
 * passer sans variables d'environnement (CI), l'erreur n'arrive qu'au moment d'une requête.
 *
 * Les accès `process.env.NEXT_PUBLIC_…` doivent rester littéraux : Next les remplace à la
 * compilation dans le bundle navigateur, une lecture dynamique (`process.env[name]`) échouerait.
 */

/**
 * Détecte une clé qui ne doit jamais atteindre un client : `sb_secret_…` (nouveau format)
 * ou un JWT dont le rôle est `service_role` (ancien format). Même contrôle que `createSupabaseClient`
 * (`@yakila/api`), qui ne l'exporte pas : à mutualiser si le package l'expose un jour.
 */
export function isServiceRoleKey(key: string): boolean {
  if (key.startsWith("sb_secret_")) return true;
  const payload = key.split(".")[1];
  if (!payload) return false;
  try {
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return (JSON.parse(json) as { role?: unknown }).role === "service_role";
  } catch {
    return false;
  }
}

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
