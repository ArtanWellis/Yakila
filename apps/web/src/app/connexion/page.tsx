import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DEFAULT_REDIRECT, safeNextPath } from "@/lib/auth/redirect";
import { getCurrentUser } from "@/lib/auth/session";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = {
  title: "Connexion",
  robots: { index: false },
};

export default async function SignInPage({ searchParams }: PageProps<"/connexion">) {
  const { next, error } = await searchParams;
  const nextPath = safeNextPath(next);

  // Déjà connecté : rien à faire ici.
  if (await getCurrentUser()) redirect(nextPath);

  const signUpHref =
    nextPath === DEFAULT_REDIRECT
      ? "/inscription"
      : `/inscription?next=${encodeURIComponent(nextPath)}`;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold tracking-tight">Connexion</h1>

      {error === "confirmation" ? (
        // Présent dès le chargement : `role="alert"` (une zone aria-live vide au départ ne serait pas lue).
        <p
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100"
        >
          Le lien de confirmation est invalide ou a expiré. Si tu as déjà confirmé ton adresse,
          connecte-toi ci-dessous.
        </p>
      ) : null}

      <SignInForm next={nextPath} signUpHref={signUpHref} />
    </div>
  );
}
