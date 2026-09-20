"use client";

import { usernameSchema } from "@yakila/validation";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { primaryButton, linkClass } from "@/components/button-styles";
import { FormMessage, TextField } from "@/components/form-fields";
import { signUpAction, type SignUpState } from "@/lib/auth/actions";
import { useUsernameAvailability, type UsernameAvailability } from "./use-username-availability";

const USERNAME_HELP = "3 à 30 caractères : lettres, chiffres et _. Visible sur ton profil public.";

const availabilityHint: Record<UsernameAvailability, string> = {
  idle: USERNAME_HELP,
  checking: USERNAME_HELP,
  available: "Ce pseudo est libre.",
  taken: USERNAME_HELP,
  unknown: USERNAME_HELP,
};

export function SignUpForm({ next, loginHref }: { next: string; loginHref: string }) {
  const [state, formAction, pending] = useActionState<SignUpState, FormData>(signUpAction, {});
  const [username, setUsername] = useState("");
  // Réponse du serveur au moment où le pseudo a été modifié pour la dernière fois.
  const [editedDuring, setEditedDuring] = useState<SignUpState | null>(null);

  const parsedUsername = usernameSchema.safeParse(username);
  const availability = useUsernameAvailability(parsedUsername.success ? parsedUsername.data : null);

  // Une erreur du serveur ne vaut que pour le pseudo envoyé : elle disparaît dès qu'on le modifie,
  // et revient avec la réponse suivante (nouvel objet `state`).
  const serverUsernameError = editedDuring === state ? undefined : state.errors?.username;
  const usernameError =
    serverUsernameError ?? (availability === "taken" ? "Ce pseudo est déjà pris." : undefined);

  if (state.checkEmail) return <CheckEmailNotice email={state.checkEmail} loginHref={loginHref} />;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold tracking-tight">Créer mon compte</h1>

      <form action={formAction} className="flex flex-col gap-5">
        <input type="hidden" name="next" value={next} />

        <TextField
          name="email"
          label="Adresse e-mail"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          defaultValue={state.values?.email}
          error={state.errors?.email}
        />

        <TextField
          name="username"
          label="Pseudo"
          autoComplete="nickname"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          minLength={3}
          maxLength={30}
          defaultValue={state.values?.username}
          onChange={(event) => {
            setUsername(event.target.value);
            setEditedDuring(state);
          }}
          hint={availabilityHint[availability]}
          error={usernameError}
        />

        <TextField
          name="password"
          label="Mot de passe"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={72}
          hint="8 caractères minimum."
          error={state.errors?.password}
        />

        <FormMessage message={state.message} />

        <button type="submit" className={primaryButton} disabled={pending}>
          {pending ? "Création du compte…" : "Créer mon compte"}
        </button>
      </form>

      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Déjà un compte ?{" "}
        <Link href={loginHref} className={linkClass}>
          Me connecter
        </Link>
      </p>
    </div>
  );
}

/** Confirmation d'e-mail active : pas de session tant que le lien reçu n'a pas été ouvert. */
function CheckEmailNotice({ email, loginHref }: { email: string; loginHref: string }) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Le formulaire vient de disparaître : replace le focus pour que le changement soit annoncé.
  useEffect(() => headingRef.current?.focus(), []);

  return (
    <div className="flex flex-col gap-4">
      <h1 ref={headingRef} tabIndex={-1} className="text-3xl font-bold tracking-tight outline-none">
        Vérifie ta boîte mail
      </h1>
      <p>
        On t&apos;a envoyé un lien de confirmation à <strong className="break-all">{email}</strong>.
        Clique dessus pour activer ton compte.
      </p>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Rien reçu ? Regarde dans tes courriers indésirables, puis réessaie dans quelques minutes.
      </p>
      <Link href={loginHref} className={linkClass}>
        Aller à la connexion
      </Link>
    </div>
  );
}
