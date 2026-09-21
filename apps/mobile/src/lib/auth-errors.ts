/** Forme minimale d'une erreur Supabase Auth (`AuthError`) : suffit à la typer sans importer supabase-js. */
export interface AuthErrorLike {
  message: string;
  name?: string;
  code?: string | undefined;
  status?: number | undefined;
}

const NETWORK_MESSAGE = "Connexion impossible. Vérifie ta connexion internet et réessaie.";
const RATE_LIMIT_MESSAGE = "Trop de tentatives. Patiente quelques minutes avant de réessayer.";

/** Convertit une valeur attrapée (`catch`) : une `Error` (dont `TimeoutError`) telle quelle, sinon une erreur vide. */
export function asErrorLike(error: unknown): AuthErrorLike {
  return error instanceof Error ? error : { message: "" };
}

/** `TimeoutError` (src/lib/timeout.ts) : l'appel n'a pas répondu dans le délai imparti. */
function isTimeout(error: AuthErrorLike): boolean {
  return error.name === "TimeoutError";
}

/** `AuthRetryableFetchError` : réseau coupé ou passerelle indisponible (502 à 504). */
function isNetworkError(error: AuthErrorLike): boolean {
  return error.name === "AuthRetryableFetchError";
}

export function isRateLimited(error: AuthErrorLike): boolean {
  return (
    error.status === 429 ||
    error.code === "over_request_rate_limit" ||
    error.code === "over_email_send_rate_limit"
  );
}

/** Connexion refusée parce que l'adresse e-mail n'est pas encore confirmée (mot de passe correct). */
export function isEmailNotConfirmed(error: AuthErrorLike): boolean {
  return error.code === "email_not_confirmed";
}

/**
 * Message de connexion. Volontairement générique pour un mauvais e-mail ou mot de passe, et aussi
 * pour un compte suspendu (`user_banned`) : on ne révèle pas si le compte existe ni son état, comme
 * sur le web. `email_not_confirmed` n'est renvoyé qu'avec le bon mot de passe, il peut donc être
 * précisé sans rien divulguer.
 */
export function describeSignInError(error: AuthErrorLike): string {
  if (isTimeout(error)) {
    return "La connexion met trop de temps. Vérifie ta connexion internet et réessaie.";
  }
  if (isNetworkError(error)) return NETWORK_MESSAGE;
  if (isRateLimited(error)) return RATE_LIMIT_MESSAGE;
  if (isEmailNotConfirmed(error)) {
    return "Adresse e-mail pas encore confirmée. Ouvre l'e-mail de confirmation que nous t'avons envoyé.";
  }
  if (
    error.code === "invalid_credentials" ||
    error.code === "user_banned" ||
    /invalid login credentials/i.test(error.message)
  ) {
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
  // Sans réponse, on ne sait pas si le compte a été créé : ne pas laisser croire à un échec.
  if (isTimeout(error)) {
    return {
      message:
        "L'inscription met trop de temps. Elle a peut-être abouti : vérifie ta boîte mail ou connecte-toi.",
    };
  }
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

/**
 * Message d'échec du renvoi de l'e-mail de confirmation. Le succès, lui, a toujours le même texte
 * (voir `ResendConfirmationEmail`) : GoTrue ne répond pas différemment selon que l'adresse existe ou non.
 */
export function describeResendError(error: AuthErrorLike): string {
  if (isTimeout(error)) {
    return "La demande met trop de temps. L'e-mail a peut-être été envoyé : regarde ta boîte mail avant de réessayer.";
  }
  if (isNetworkError(error)) return NETWORK_MESSAGE;
  if (isRateLimited(error)) {
    return "Un e-mail a déjà été envoyé récemment. Patiente une minute avant d'en demander un autre.";
  }
  return "Impossible d'envoyer l'e-mail pour le moment. Réessaie plus tard.";
}
