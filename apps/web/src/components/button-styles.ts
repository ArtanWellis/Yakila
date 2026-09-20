/**
 * Classes Tailwind partagées par les boutons et les liens-boutons (44 px de haut minimum pour le
 * tactile). Un seul endroit pour changer l'identité visuelle tant que shadcn/ui n'est pas installé.
 */
const base =
  "inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-base font-semibold " +
  "transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 " +
  "focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 " +
  "dark:focus-visible:outline-emerald-400";

export const primaryButton = `${base} bg-emerald-700 text-white hover:bg-emerald-800`;

export const secondaryButton =
  `${base} border border-zinc-300 bg-transparent hover:bg-zinc-100 ` +
  "dark:border-zinc-700 dark:hover:bg-zinc-900";

export const linkClass =
  "font-medium text-emerald-800 underline underline-offset-2 hover:text-emerald-900 " +
  "dark:text-emerald-400 dark:hover:text-emerald-300";
