import Image from "next/image";
import { initialsOf, isTrustedAvatarUrl } from "@/lib/avatar";

/**
 * Avatar rond. Décoratif (`alt=""`) : le nom est toujours affiché à côté. Sans photo valide,
 * affiche les initiales. Servi par l'optimiseur d'images de Next (domaine autorisé dans `next.config.ts`).
 */
export function Avatar({
  url,
  name,
  size,
}: {
  url: string | null;
  name: string;
  /** Côté en pixels. */
  size: number;
}) {
  // Littéral `process.env.NEXT_PUBLIC_…` : remplacé à la compilation, valable aussi côté navigateur.
  const trusted = url !== null && isTrustedAvatarUrl(url, process.env.NEXT_PUBLIC_SUPABASE_URL);

  if (trusted) {
    return (
      <Image
        src={url}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-full bg-zinc-200 object-cover dark:bg-zinc-800"
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center rounded-full bg-emerald-100 font-semibold text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
      style={{ width: size, height: size, fontSize: size / 2.5 }}
    >
      {initialsOf(name)}
    </span>
  );
}
