"use client";

import Link from "next/link";
import { useActionState } from "react";
import { linkClass, primaryButton } from "@/components/button-styles";
import { FormMessage, TextField } from "@/components/form-fields";
import { signInAction, type SignInState } from "@/lib/auth/actions";

export function SignInForm({ next, signUpHref }: { next: string; signUpHref: string }) {
  const [state, formAction, pending] = useActionState<SignInState, FormData>(signInAction, {});

  return (
    <div className="flex flex-col gap-6">
      <form action={formAction} className="flex flex-col gap-5">
        <input type="hidden" name="next" value={next} />

        <TextField
          name="email"
          label="Adresse e-mail"
          type="email"
          autoComplete="username"
          inputMode="email"
          required
          defaultValue={state.values?.email}
          error={state.errors?.email}
        />

        <TextField
          name="password"
          label="Mot de passe"
          type="password"
          autoComplete="current-password"
          required
          error={state.errors?.password}
        />

        <FormMessage message={state.message} />

        <button type="submit" className={primaryButton} disabled={pending}>
          {pending ? "Connexion…" : "Me connecter"}
        </button>
      </form>

      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Pas encore de compte ?{" "}
        <Link href={signUpHref} className={linkClass}>
          Créer mon compte
        </Link>
      </p>
    </div>
  );
}
