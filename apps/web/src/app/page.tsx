import { SEARCH_RADII_KM } from "@yakila/types";
import { formatDistanceKm } from "@yakila/utils";

const actions = [
  { title: "J'ai besoin de quelqu'un", hint: "Rechercher un service près de chez moi" },
  { title: "Je veux gagner de l'argent", hint: "Proposer un service ou répondre à une mission" },
  { title: "Je veux acheter ou vendre", hint: "YaKoiLa, les annonces autour de moi" },
];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-4xl font-bold tracking-tight">YaKiLa</h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400">
          Trouve quelqu&apos;un, propose tes services et gagne de l&apos;argent autour de toi.
        </p>
      </header>
      <ul className="flex flex-col gap-3">
        {actions.map((action) => (
          <li
            key={action.title}
            className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
          >
            <p className="font-semibold">{action.title}</p>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{action.hint}</p>
          </li>
        ))}
      </ul>
      <p className="text-sm text-zinc-500">
        Rayons de recherche : {SEARCH_RADII_KM.map(formatDistanceKm).join(" · ")}
      </p>
    </main>
  );
}
