export default function ProfileLoading() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-live="polite">
      <span className="sr-only">Chargement de ton profil…</span>
      <div className="h-9 w-48 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
      <div className="flex items-center gap-4">
        <div className="size-24 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-11 w-40 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
      </div>
      <div className="h-11 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
      <div className="h-28 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
    </div>
  );
}
