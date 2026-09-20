/** Destination par défaut après connexion ou inscription. */
export const DEFAULT_REDIRECT = "/profil";

/** Préfixes réservés aux utilisateurs connectés (contrôle « optimiste » du proxy). */
const PROTECTED_PREFIXES = ["/profil"];

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Paramètre `next` : n'accepte qu'un chemin local, sinon retourne `fallback` (pas d'open redirect).
 * Refuse `//hôte`, `/\hôte`, les caractères de contrôle (les navigateurs retirent tabulations et
 * retours à la ligne des URL, `/\t/evil.com` deviendrait `//evil.com`) et tout ce qui,
 * une fois normalisé (`/..//evil.com`), commence par `//`.
 */
export function safeNextPath(value: unknown, fallback: string = DEFAULT_REDIRECT): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 512) return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code < 0x20 || code === 0x7f || char === "\\") return fallback;
  }
  try {
    const base = "http://localhost";
    const url = new URL(value, base);
    if (url.origin !== base) return fallback;
    const path = url.pathname + url.search + url.hash;
    return path.startsWith("//") ? fallback : path;
  } catch {
    return fallback;
  }
}
