"use server";

import { updateOwnProfile } from "@yakila/api";
import { updateProfileSchema } from "@yakila/validation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { fieldErrors, formString, type FormState } from "@/lib/forms";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const PROFILE_FIELDS = ["displayName", "bio", "city"] as const;

export type ProfileFormState = FormState<(typeof PROFILE_FIELDS)[number]>;

/**
 * Met à jour nom affiché, bio et ville. Joignable par un simple POST : on revérifie la session,
 * on re-valide avec le schéma partagé, et on modifie uniquement la ligne de l'utilisateur connecté
 * (l'identité vient de la session, jamais du formulaire ; la RLS et les privilèges de colonnes
 * de la base l'imposent aussi). Le pseudo et l'avatar ne passent pas par ici.
 */
export async function updateProfileAction(
  _previous: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const values = {
    displayName: formString(formData, "displayName"),
    // Un envoi de formulaire transmet les retours à la ligne d'un <textarea> en CRLF (2 caractères) :
    // on les ramène à `\n`, comme sur le mobile, pour qu'ils ne comptent qu'une fois dans les 500 caractères.
    bio: formString(formData, "bio").replace(/\r\n?/g, "\n"),
    city: formString(formData, "city"),
  };

  const user = await getCurrentUser();
  if (!user) {
    return { status: "error", message: "Ta session a expiré. Reconnecte-toi.", values };
  }

  const parsed = updateProfileSchema.safeParse(values);
  if (!parsed.success) {
    return { status: "error", errors: fieldErrors(parsed.error.issues, PROFILE_FIELDS), values };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await updateOwnProfile(supabase, user.id, parsed.data);
  if (error) {
    console.error("[profil] mise à jour refusée :", error.code);
    return {
      status: "error",
      message: "Enregistrement impossible. Réessaie dans un instant.",
      values,
    };
  }

  revalidatePath("/profil");
  // Ré-affiche les valeurs normalisées (espaces retirés), telles qu'enregistrées.
  return {
    status: "saved",
    message: "Profil enregistré.",
    values: {
      displayName: parsed.data.displayName ?? "",
      bio: parsed.data.bio ?? "",
      city: parsed.data.city ?? "",
    },
  };
}
