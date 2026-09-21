/**
 * N'affiche un avatar que s'il vient du bucket `avatars` de notre projet Supabase (hôte compris :
 * la base n'impose que la forme du chemin). Implémentation partagée avec le mobile dans
 * `@yakila/api` ; réexportée ici pour que les appelants du web n'aient rien à changer.
 * Sert aussi à éviter que `next/image` plante sur un hôte non configuré.
 */
export { isTrustedAvatarUrl } from "@yakila/api";

/** Premier caractère d'un mot. Pas `charAt(0)` : il couperait en deux un emoji (paire de substitution). */
function firstCharacter(word: string): string {
  return Array.from(word)[0] ?? "";
}

/** Initiales pour l'avatar de secours : "Marie Dupont" -> "MD", "marie_d" -> "M". */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.slice(0, 2).map((word) => firstCharacter(word).toUpperCase());
  return letters.join("") || "?";
}
