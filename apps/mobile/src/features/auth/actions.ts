import { isUsernameAvailable } from "@yakila/api";
import type { SignInInput, SignUpInput } from "@yakila/validation";
import { supabase } from "@/lib/supabase";

/**
 * `true` / `false`, ou `null` si la vérification a échoué (réseau…). Simple confort d'interface :
 * seule la contrainte d'unicité de la base fait foi, l'inscription n'est donc pas bloquée sur `null`.
 */
export async function checkUsernameAvailable(username: string): Promise<boolean | null> {
  const { data } = await isUsernameAvailable(supabase, username);
  return data;
}

/** Connexion e-mail + mot de passe. Le changement d'état passe par `onAuthStateChange` (SessionProvider). */
export function signInWithPassword({ email, password }: SignInInput) {
  return supabase.auth.signInWithPassword({ email, password });
}

/**
 * Inscription. Le pseudo voyage dans `options.data.username` : le trigger de la base en fait le
 * `username` du profil (et refuse l'inscription s'il est invalide ou déjà pris).
 * Sans session dans la réponse, la confirmation d'e-mail est active.
 */
export function signUpWithUsername({ email, password, username }: SignUpInput) {
  return supabase.auth.signUp({ email, password, options: { data: { username } } });
}

/**
 * Déconnexion de cet appareil seulement (`local`). Le défaut de supabase-js est `global`, qui
 * fermerait aussi les sessions du web et des autres téléphones.
 */
export function signOutFromThisDevice() {
  return supabase.auth.signOut({ scope: "local" });
}
