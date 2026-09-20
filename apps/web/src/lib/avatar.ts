/** Préfixe du chemin public du bucket `avatars` dans Supabase Storage. */
const AVATAR_PATH_PREFIX = "/storage/v1/object/public/avatars/";

/**
 * N'affiche un avatar que s'il vient du bucket `avatars` de notre projet Supabase. La base impose
 * déjà cette forme (contrainte `check` sur `profiles.avatar_url`) ; ce contrôle est une seconde
 * barrière côté interface, et évite aussi que `next/image` plante sur un hôte non configuré.
 */
export function isTrustedAvatarUrl(avatarUrl: string, supabaseUrl: string | undefined): boolean {
  if (!supabaseUrl) return false;
  try {
    const avatar = new URL(avatarUrl);
    const supabase = new URL(supabaseUrl);
    return avatar.origin === supabase.origin && avatar.pathname.startsWith(AVATAR_PATH_PREFIX);
  } catch {
    return false;
  }
}

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
