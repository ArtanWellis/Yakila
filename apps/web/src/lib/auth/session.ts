import { redirect } from "next/navigation";
import { cache } from "react";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export interface CurrentUser {
  id: string;
  email: string | undefined;
}

/**
 * Utilisateur de la requête, ou `null`. Mémoïsé le temps d'un rendu (`cache`) : l'en-tête, la page
 * et les Server Actions peuvent l'appeler sans multiplier les vérifications.
 *
 * Utilise `getClaims()` : le JWT est vérifié (signature et expiration), on ne se fie jamais au
 * contenu brut du cookie comme le ferait `getSession()`. Limite : un compte supprimé ou banni reste
 * « connecté » jusqu'à l'expiration du jeton (1 h par défaut). Pour une action sensible
 * (suppression de compte, changement d'e-mail), passer par `supabase.auth.getUser()`.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return { id: claims.sub, email: claims.email };
});

/** Pour une page protégée : redirige vers la connexion (en gardant la destination) si anonyme. */
export async function requireUser(returnTo: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/connexion?next=${encodeURIComponent(returnTo)}`);
  return user;
}
