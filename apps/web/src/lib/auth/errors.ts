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
  // Message neutre, sans champ désigné : ne pas confirmer qu'un compte existe pour cette adresse
  // (énumération de comptes). Même formulation que le mobile.
  if (error.code === "user_already_exists" || error.code === "email_exists") {
    return {
      message:
        "Inscription impossible avec ces informations. Si tu as déjà un compte, connecte-toi.",
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
 * Réponse au renvoi de l'e-mail de confirmation. Succès neutre : GoTrue ne dit pas si l'adresse a un
 * compte (ni s'il est déjà confirmé), et nous non plus.
 */
export const RESEND_SENT_MESSAGE =
  "Si un compte attend sa confirmation pour cette adresse, un nouvel e-mail vient d'être envoyé.";

export function resendFailureMessage(error: AuthErrorLike): string {
  if (error.code && RATE_LIMIT_CODES.includes(error.code)) {
    return "Un e-mail vient d'être envoyé. Attends une minute avant d'en demander un autre.";
  }
  return "Envoi impossible pour le moment. Réessaie dans un instant.";
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
