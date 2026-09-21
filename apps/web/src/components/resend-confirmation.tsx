"use client";

import { useActionState, useEffect, useState } from "react";
import { resendConfirmationAction, type ResendState } from "@/lib/auth/actions";
import { secondaryButton } from "./button-styles";
import { FormMessage } from "./form-fields";

const COOLDOWN_SECONDS = 60;

/**
 * Bouton « Renvoyer l'e-mail » avec 60 s d'attente entre deux envois (les limites réelles sont
 * celles de Supabase, ce délai évite juste de les atteindre). `cooldownOnMount` : à utiliser quand un
 * e-mail vient de partir (fin d'inscription) ; après un refus de connexion, aucun envoi n'a eu lieu, donc
 * on peut cliquer tout de suite. Formulaire à part : ne pas l'imbriquer dans un autre `<form>`.
 */
export function ResendConfirmation({
  email,
  cooldownOnMount = false,
}: {
  email: string;
  cooldownOnMount?: boolean;
}) {
  const [secondsLeft, setSecondsLeft] = useState(cooldownOnMount ? COOLDOWN_SECONDS : 0);
  const [state, formAction, pending] = useActionState<ResendState, FormData>(
    async (previous, formData) => {
      const result = await resendConfirmationAction(previous, formData);
      setSecondsLeft(COOLDOWN_SECONDS);
      return result;
    },
    {},
  );

  // Décompte : `setState` dans le rappel du minuteur (jamais synchrone dans l'effet).
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  const waiting = secondsLeft > 0;

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="email" value={email} />
      <FormMessage message={state.message} tone={state.status === "sent" ? "success" : "error"} />
      <button type="submit" className={secondaryButton} disabled={pending || waiting}>
        {pending
          ? "Envoi…"
          : waiting
            ? `Renvoyer l'e-mail (${secondsLeft} s)`
            : "Renvoyer l'e-mail"}
      </button>
    </form>
  );
}
