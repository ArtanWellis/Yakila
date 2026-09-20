"use client";

import { useActionState } from "react";
import { primaryButton } from "@/components/button-styles";
import { FormMessage, TextAreaField, TextField } from "@/components/form-fields";
import { updateProfileAction, type ProfileFormState } from "@/lib/profile/actions";

export function ProfileForm({
  displayName,
  bio,
  city,
}: {
  displayName: string;
  bio: string;
  city: string;
}) {
  const [state, formAction, pending] = useActionState<ProfileFormState, FormData>(
    updateProfileAction,
    {},
  );

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <TextField
        name="displayName"
        label="Nom affiché"
        autoComplete="nickname"
        maxLength={50}
        defaultValue={state.values?.displayName ?? displayName}
        error={state.errors?.displayName}
      />

      <TextAreaField
        name="bio"
        label="À propos de toi"
        rows={4}
        maxLength={500}
        autoComplete="off"
        hint="500 caractères max. Visible sur ton profil public."
        defaultValue={state.values?.bio ?? bio}
        error={state.errors?.bio}
      />

      <TextField
        name="city"
        label="Ville"
        autoComplete="address-level2"
        maxLength={100}
        hint="Visible sur ton profil public."
        defaultValue={state.values?.city ?? city}
        error={state.errors?.city}
      />

      <FormMessage message={state.message} tone={state.status === "saved" ? "success" : "error"} />

      <button type="submit" className={primaryButton} disabled={pending}>
        {pending ? "Enregistrement…" : "Enregistrer"}
      </button>
    </form>
  );
}
