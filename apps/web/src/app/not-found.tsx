import Link from "next/link";
import { primaryButton } from "@/components/button-styles";

export default function NotFound() {
  return (
    <div className="flex flex-col items-start gap-4">
      <h1 className="text-3xl font-bold tracking-tight">Page introuvable</h1>
      <p className="text-zinc-600 dark:text-zinc-400">Cette page n&apos;existe pas, ou plus.</p>
      <Link href="/" className={primaryButton}>
        Retour à l&apos;accueil
      </Link>
    </div>
  );
}
