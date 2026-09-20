export type AuthState =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "signed-in"; userId: string; email: string | null };

export type SignedInState = Extract<AuthState, { status: "signed-in" }>;

interface UserLike {
  id: string;
  email?: string | undefined;
}

/**
 * État d'authentification suivant, à partir de l'utilisateur de la session (ou `null`).
 * Retourne l'état précédent tel quel (même référence) quand rien n'a changé : un
 * `TOKEN_REFRESHED` (toutes les heures environ) ne provoque alors aucun rendu des écrans.
 */
export function nextAuthState(previous: AuthState, user: UserLike | null): AuthState {
  if (user === null) {
    return previous.status === "signed-out" ? previous : { status: "signed-out" };
  }
  const email = user.email ?? null;
  if (previous.status === "signed-in" && previous.userId === user.id && previous.email === email) {
    return previous;
  }
  return { status: "signed-in", userId: user.id, email };
}
