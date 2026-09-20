/** Forme minimale d'une `AuthError` de Supabase : évite de dépendre de `@supabase/supabase-js` ici. */
export interface AuthErrorLike {
  code?: string;
  message?: string;
  status?: number;
}

export interface SignUpFailure {
  field?: "email" | "username";
  message: string;
}

const RATE_LIMIT_CODES = ["over_request_rate_limit", "over_email_send_rate_limit"];

/**
 * Le trigger d'inscription lève une exception quand le pseudo est pris ou invalide ; GoTrue la
 * remonte sous ce message générique. Le formulaire vérifie déjà le format et la disponibilité,
 * il reste donc surtout le cas d'une course entre deux inscriptions.
 */
const GENERIC_DB_ERROR = "Database error saving new user";

export const USERNAME_TAKEN_MESSAGE = "Ce pseudo est probablement déjà pris. Essaies-en un autre.";

export function signUpFailure(error: AuthErrorLike): SignUpFailure {
  if (error.message?.includes(GENERIC_DB_ERROR)) {
    return { field: "username", message: USERNAME_TAKEN_MESSAGE };
  }
  if (error.code === "user_already_exists" || error.code === "email_exists") {
    return {
      field: "email",
      message: "Un compte existe déjà avec cette adresse e-mail. Connecte-toi plutôt.",
    };
  }
  if (error.code === "email_address_invalid") {
    return { field: "email", message: "Cette adresse e-mail n'est pas acceptée." };
  }
  if (error.code === "weak_password") {
    return { message: "Ce mot de passe est trop faible. Choisis-en un plus long ou plus varié." };
  }
  if (error.code === "signup_disabled") {
    return { message: "Les inscriptions sont fermées pour le moment." };
  }
  if (error.code && RATE_LIMIT_CODES.includes(error.code)) {
    return { message: "Trop de tentatives. Réessaie dans quelques minutes." };
  }
  return { message: "Inscription impossible pour le moment. Réessaie dans un instant." };
}

/**
 * Message de connexion. Volontairement générique : ne jamais dire si c'est l'e-mail ou le mot de
 * passe qui est faux. Deux exceptions sans risque d'énumération : GoTrue ne renvoie
 * `email_not_confirmed` qu'après avoir vérifié le mot de passe, et une panne n'est pas un mauvais mot de passe.
 */
export function signInErrorMessage(error: AuthErrorLike): string {
  if (error.code === "email_not_confirmed") {
    return "Ton adresse e-mail n'est pas encore confirmée. Clique sur le lien reçu par e-mail.";
  }
  if (error.code && RATE_LIMIT_CODES.includes(error.code)) {
    return "Trop de tentatives. Réessaie dans quelques minutes.";
  }
  if (error.status === undefined || error.status === 0 || error.status >= 500) {
    return "Connexion impossible pour le moment. Réessaie dans un instant.";
  }
  return "Identifiants incorrects.";
}
