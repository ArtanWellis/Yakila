export const SITE_NAME = "YaKiLa";

const FALLBACK_SITE_URL = "http://localhost:3000";

/**
 * URL publique du site (`NEXT_PUBLIC_SITE_URL`), base des URL canoniques et Open Graph.
 * Ne lève jamais : elle est appelée à l'import du layout, donc pendant `next build`.
 */
export function getSiteUrl(): URL {
  try {
    return new URL(process.env.NEXT_PUBLIC_SITE_URL ?? FALLBACK_SITE_URL);
  } catch {
    return new URL(FALLBACK_SITE_URL);
  }
}
