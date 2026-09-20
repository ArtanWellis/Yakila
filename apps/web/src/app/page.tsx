import Link from "next/link";
import { primaryButton, secondaryButton } from "@/components/button-styles";
import { getCurrentUser } from "@/lib/auth/session";

const actions = [
  { title: "J'ai besoin de quelqu'un", hint: "Rechercher un service près de chez moi" },
  { title: "Je veux gagner de l'argent", hint: "Proposer un service ou répondre à une mission" },
  { title: "Je veux acheter ou vendre", hint: "YaKoiLa, les annonces autour de moi" },
];

export default async function Home() {
  const user = await getCurrentUser();

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <h1 className="text-4xl font-bold tracking-tight">YaKiLa</h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400">
          Trouve quelqu&apos;un, propose tes services et gagne de l&apos;argent autour de toi.
        </p>
        <div className="flex flex-wrap gap-3">
          {user ? (
            <Link href="/profil" className={primaryButton}>
              Mon profil
            </Link>
          ) : (
            <>
              <Link href="/inscription" className={primaryButton}>
                Créer mon compte
              </Link>
              <Link href="/connexion" className={secondaryButton}>
                Me connecter
              </Link>
            </>
          )}
        </div>
      </section>

      <ul className="flex flex-col gap-3">
        {actions.map((action) => (
          <li
            key={action.title}
            className="flex items-start justify-between gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
          >
            <div>
              <p className="font-semibold">{action.title}</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">{action.hint}</p>
            </div>
            <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              Bientôt
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
