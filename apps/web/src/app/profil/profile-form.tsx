"use client";

import { BIO_MAX, CITY_MAX, DISPLAY_NAME_MAX } from "@yakila/validation";
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
        maxLength={DISPLAY_NAME_MAX}
        defaultValue={state.values?.displayName ?? displayName}
        error={state.errors?.displayName}
      />

      <TextAreaField
        name="bio"
        label="À propos de toi"
        rows={4}
        maxLength={BIO_MAX}
        autoComplete="off"
        hint={`${BIO_MAX} caractères max. Visible sur ton profil public.`}
        defaultValue={state.values?.bio ?? bio}
        error={state.errors?.bio}
      />

      <TextField
        name="city"
        label="Ville"
        autoComplete="address-level2"
        maxLength={CITY_MAX}
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
