import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DEFAULT_REDIRECT, safeNextPath } from "@/lib/auth/redirect";
import { getCurrentUser } from "@/lib/auth/session";
import { SignUpForm } from "./sign-up-form";

export const metadata: Metadata = {
  title: "Créer mon compte",
  robots: { index: false },
};

export default async function SignUpPage({ searchParams }: PageProps<"/inscription">) {
  const { next } = await searchParams;
  const nextPath = safeNextPath(next);

  // Déjà connecté : rien à faire ici.
  if (await getCurrentUser()) redirect(nextPath);

  const loginHref =
    nextPath === DEFAULT_REDIRECT
      ? "/connexion"
      : `/connexion?next=${encodeURIComponent(nextPath)}`;

  return <SignUpForm next={nextPath} loginHref={loginHref} />;
}
