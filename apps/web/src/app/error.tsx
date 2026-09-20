"use client";

import Link from "next/link";
import { useEffect } from "react";
import { primaryButton, secondaryButton } from "@/components/button-styles";

/**
 * Erreur inattendue d'une page (par exemple Supabase injoignable). En production le message
 * d'origine n'arrive pas au navigateur, seul `digest` permet de retrouver l'erreur dans les logs.
 * `retry` (stable depuis Next 16.3) re-récupère et re-rend le segment, contrairement à `reset`.
 */
export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-start gap-4" role="alert">
      <h1 className="text-3xl font-bold tracking-tight">Oups, ça n&apos;a pas marché</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        Un problème est survenu de notre côté. Réessaie dans un instant.
      </p>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => retry()} className={primaryButton}>
          Réessayer
        </button>
        <Link href="/" className={secondaryButton}>
          Accueil
        </Link>
      </div>
    </div>
  );
}
