/** Forme minimale d'une erreur Supabase Auth (`AuthError`) : suffit à la typer sans importer supabase-js. */
export interface AuthErrorLike {
  message: string;
  name?: string;
  code?: string | undefined;
  status?: number | undefined;
}

const NETWORK_MESSAGE = "Connexion impossible. Vérifie ta connexion internet et réessaie.";
const RATE_LIMIT_MESSAGE = "Trop de tentatives. Patiente quelques minutes avant de réessayer.";

/** `AuthRetryableFetchError` : réseau coupé ou passerelle indisponible (502 à 504). */
function isNetworkError(error: AuthErrorLike): boolean {
  return error.name === "AuthRetryableFetchError";
}

function isRateLimited(error: AuthErrorLike): boolean {
  return (
    error.status === 429 ||
    error.code === "over_request_rate_limit" ||
    error.code === "over_email_send_rate_limit"
  );
}

/**
 * Message de connexion. Volontairement générique pour un mauvais e-mail ou mot de passe : on ne
 * révèle pas si le compte existe. `email_not_confirmed` n'est renvoyé qu'avec le bon mot de passe,
 * il peut donc être précisé sans rien divulguer.
 */
export function describeSignInError(error: AuthErrorLike): string {
  if (isNetworkError(error)) return NETWORK_MESSAGE;
  if (isRateLimited(error)) return RATE_LIMIT_MESSAGE;
  if (error.code === "email_not_confirmed") {
    return "Adresse e-mail pas encore confirmée. Ouvre l'e-mail de confirmation que nous t'avons envoyé.";
  }
  if (error.code === "user_banned") return "Ce compte est suspendu.";
  if (error.code === "invalid_credentials" || /invalid login credentials/i.test(error.message)) {
    return "Identifiants incorrects.";
  }
  return "Connexion impossible pour le moment. Réessaie plus tard.";
}

export interface SignUpErrorDescription {
  message: string;
  /** Champ à mettre en évidence dans le formulaire, s'il y en a un. */
  field?: "username";
}

/**
 * Message d'inscription. Quand le trigger de la base refuse le pseudo (déjà pris, invalide), GoTrue
 * ne renvoie qu'une erreur générique « Database error saving new user ».
 * La vérification `isUsernameAvailable` en amont n'est qu'un confort : deux inscriptions simultanées
 * peuvent la passer.
 *
 * On se fie au message, pas au code : `unexpected_failure` est le code de TOUTE erreur 500 de GoTrue
 * (par exemple « Error sending confirmation email »), qui n'a rien à voir avec le pseudo.
 */
export function describeSignUpError(error: AuthErrorLike): SignUpErrorDescription {
  if (isNetworkError(error)) return { message: NETWORK_MESSAGE };
  if (isRateLimited(error)) return { message: RATE_LIMIT_MESSAGE };
  if (/database error saving new user/i.test(error.message)) {
    return {
      message: "Inscription impossible : ce pseudo est probablement déjà pris. Essaie-en un autre.",
      field: "username",
    };
  }
  if (error.code === "weak_password") {
    return { message: "Mot de passe trop faible. Choisis-en un plus long ou plus varié." };
  }
  if (error.code === "signup_disabled") {
    return { message: "Les inscriptions sont fermées pour le moment." };
  }
  // Panne côté serveur (envoi d'e-mail, base…) : ne rien insinuer sur le compte ou le pseudo.
  if (error.status !== undefined && error.status >= 500) {
    return { message: "Inscription impossible pour le moment. Réessaie plus tard." };
  }
  // `user_already_exists` / `email_exists` : message neutre, pour ne pas confirmer qu'un compte existe.
  return {
    message: "Inscription impossible avec ces informations. Si tu as déjà un compte, connecte-toi.",
  };
}
