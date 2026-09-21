import { isUsernameAvailable } from "@yakila/api";
import type { SignInInput, SignUpInput } from "@yakila/validation";
import { REQUEST_TIMEOUT_MS, TimeoutError, withTimeout } from "@/lib/timeout";
import { supabase } from "@/lib/supabase";

/** Vérification de confort : courte, elle ne doit pas retarder l'inscription sur un réseau mort. */
const AVAILABILITY_CHECK_TIMEOUT_MS = 8_000;

/**
 * `true` / `false`, ou `null` si la vérification a échoué (réseau, délai dépassé…). Simple confort
 * d'interface : seule la contrainte d'unicité de la base fait foi, l'inscription n'est donc pas
 * bloquée sur `null`.
 */
export async function checkUsernameAvailable(username: string): Promise<boolean | null> {
  try {
    const { data } = await withTimeout(
      isUsernameAvailable(supabase, username),
      AVAILABILITY_CHECK_TIMEOUT_MS,
    );
    return data;
  } catch (error) {
    if (error instanceof TimeoutError) return null;
    throw error;
  }
}

/**
 * Connexion e-mail + mot de passe. Le changement d'état passe par `onAuthStateChange` (SessionProvider).
 * Les fonctions ci-dessous rejettent avec `TimeoutError` si le serveur ne répond pas à temps ;
 * l'appel d'origine, lui, continue : une connexion tardive ouvre quand même la session.
 */
export function signInWithPassword({ email, password }: SignInInput) {
  return withTimeout(supabase.auth.signInWithPassword({ email, password }), REQUEST_TIMEOUT_MS);
}

/**
 * Inscription. Le pseudo voyage dans `options.data.username` : le trigger de la base en fait le
 * `username` du profil (et refuse l'inscription s'il est invalide ou déjà pris).
 * Sans session dans la réponse, la confirmation d'e-mail est active.
 * Un `TimeoutError` ne veut PAS dire que l'inscription a échoué : elle a pu aboutir.
 */
export function signUpWithUsername({ email, password, username }: SignUpInput) {
  return withTimeout(
    supabase.auth.signUp({ email, password, options: { data: { username } } }),
    REQUEST_TIMEOUT_MS,
  );
}

/**
 * Renvoie l'e-mail de confirmation d'inscription. `email` doit être validé (`emailSchema`).
 * Aucune redirection personnalisée : même comportement que l'e-mail initial.
 */
export function resendConfirmationEmail(email: string) {
  return withTimeout(supabase.auth.resend({ type: "signup", email }), REQUEST_TIMEOUT_MS);
}

/**
 * Déconnexion de cet appareil seulement (`local`). Le défaut de supabase-js est `global`, qui
 * fermerait aussi les sessions du web et des autres téléphones.
 *
 * Retourne `true` si l'appareil est bien déconnecté. `signOut` peut renvoyer une erreur alors que
 * la session locale est déjà supprimée : dans auth-js (`GoTrueClient._signOut`), si la révocation
 * côté serveur échoue (réseau coupé, 5xx), la session locale est retirée AVANT de renvoyer l'erreur.
 * À l'inverse, avec un jeton expiré et sans réseau, l'erreur vient de la lecture de la session et
 * rien n'est retiré. On relit donc l'état local pour trancher, au lieu d'annoncer un échec à un
 * utilisateur déjà déconnecté.
 */
export async function signOutFromThisDevice(): Promise<boolean> {
  try {
    const { error } = await withTimeout(
      supabase.auth.signOut({ scope: "local" }),
      REQUEST_TIMEOUT_MS,
    );
    if (error === null) return true;
    const { data, error: sessionError } = await withTimeout(
      supabase.auth.getSession(),
      REQUEST_TIMEOUT_MS,
    );
    return sessionError === null && data.session === null;
  } catch {
    // Délai dépassé : la révocation est encore en cours (et tient le verrou d'auth-js), la session
    // locale est toujours là. On ne relit rien et on l'annonce comme un échec.
    return false;
  }
}
