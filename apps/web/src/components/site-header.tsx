import Link from "next/link";
import { Suspense } from "react";
import { signOutAction } from "@/lib/auth/actions";
import { getCurrentUser } from "@/lib/auth/session";
import { primaryButton } from "./button-styles";

const navLink =
  "inline-flex min-h-11 items-center rounded-lg px-3 text-base font-medium hover:bg-zinc-100 " +
  "focus-visible:outline-2 focus-visible:outline-emerald-700 dark:hover:bg-zinc-900 " +
  "dark:focus-visible:outline-emerald-400";

/**
 * L'état de connexion lit les cookies : il est isolé dans `AuthNav`, sous `<Suspense>`, pour que
 * le reste de la page ne dépende pas de lui (le logo s'affiche sans attendre la vérification).
 */
export function SiteHeader() {
  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800">
      <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-2 px-4 py-2">
        <Link href="/" className="rounded-lg px-1 text-xl font-bold tracking-tight">
          YaKiLa
        </Link>
        <Suspense fallback={<div className="min-h-11" aria-hidden="true" />}>
          <AuthNav />
        </Suspense>
      </div>
    </header>
  );
}

async function AuthNav() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <nav aria-label="Compte" className="flex items-center gap-1">
        <Link href="/connexion" className={navLink}>
          Connexion
        </Link>
        <Link href="/inscription" className={primaryButton}>
          Inscription
        </Link>
      </nav>
    );
  }

  return (
    <nav aria-label="Compte" className="flex items-center gap-1">
      <Link href="/profil" className={navLink}>
        Profil
      </Link>
      <form action={signOutAction}>
        <button type="submit" className={navLink}>
          Déconnexion
        </button>
      </form>
    </nav>
  );
}
