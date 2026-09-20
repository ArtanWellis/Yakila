"use server";

import { isUsernameAvailable } from "@yakila/api";
import { signInSchema, signUpSchema } from "@yakila/validation";
import { redirect } from "next/navigation";
import { fieldErrors, formString, type FormState } from "@/lib/forms";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { signInErrorMessage, signUpFailure } from "./errors";
import { safeNextPath } from "./redirect";

/**
 * Server Actions d'authentification. Elles sont joignables par un simple POST : chacune re-valide
 * l'entrée avec les schémas Zod partagés (`@yakila/validation`), sans rien supposer du formulaire.
 * `redirect()` lève une exception de contrôle : rien ne s'exécute après.
 */

const SIGN_UP_FIELDS = ["email", "password", "username"] as const;
const SIGN_IN_FIELDS = ["email", "password"] as const;

export type SignUpState = FormState<(typeof SIGN_UP_FIELDS)[number]> & {
  /** Adresse à laquelle le lien de confirmation vient d'être envoyé (confirmation d'e-mail active). */
  checkEmail?: string;
};
export type SignInState = FormState<(typeof SIGN_IN_FIELDS)[number]>;

export async function signUpAction(
  _previous: SignUpState,
  formData: FormData,
): Promise<SignUpState> {
  const values = {
    email: formString(formData, "email"),
    username: formString(formData, "username"),
  };
  const parsed = signUpSchema.safeParse({ ...values, password: formString(formData, "password") });
  if (!parsed.success) {
    return { status: "error", errors: fieldErrors(parsed.error.issues, SIGN_UP_FIELDS), values };
  }
  const { email, password, username } = parsed.data;

  const supabase = await createServerSupabaseClient();

  // Confort : un message précis vaut mieux que l'erreur générique de GoTrue. Si le contrôle échoue
  // (réseau, table absente), on tente quand même : seule la contrainte d'unicité de la base fait foi.
  const availability = await isUsernameAvailable(supabase, username);
  if (availability.data === false) {
    return { status: "error", errors: { username: "Ce pseudo est déjà pris." }, values };
  }

  // Le pseudo passe par les métadonnées : le trigger d'inscription en crée le profil.
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username } },
  });

  if (error) {
    console.error("[auth] inscription refusée :", error.code ?? error.status);
    const failure = signUpFailure(error);
    return failure.field
      ? { status: "error", errors: { [failure.field]: failure.message }, values }
      : { status: "error", message: failure.message, values };
  }

  // Confirmation d'e-mail active côté Supabase : pas de session, il faut cliquer sur le lien reçu.
  if (!data.session) return { checkEmail: email };

  redirect(safeNextPath(formString(formData, "next")));
}

export async function signInAction(
  _previous: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const values = { email: formString(formData, "email") };
  const parsed = signInSchema.safeParse({ ...values, password: formString(formData, "password") });
  if (!parsed.success) {
    return { status: "error", errors: fieldErrors(parsed.error.issues, SIGN_IN_FIELDS), values };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    console.error("[auth] connexion refusée :", error.code ?? error.status);
    return { status: "error", message: signInErrorMessage(error), values };
  }

  redirect(safeNextPath(formString(formData, "next")));
}

export async function signOutAction(): Promise<void> {
  const supabase = await createServerSupabaseClient();
  // `local` : seulement cet appareil. Le défaut de supabase-js (`global`) déconnecterait tous les appareils.
  await supabase.auth.signOut({ scope: "local" });
  redirect("/");
}
