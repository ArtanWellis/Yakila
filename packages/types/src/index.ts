import type { Database } from "./database";

export type { Database, Json } from "./database";

/** Rayons de recherche proposés à l'utilisateur, en kilomètres. */
export const SEARCH_RADII_KM = [2, 5, 10, 25, 50] as const;
export type SearchRadiusKm = (typeof SEARCH_RADII_KM)[number];

/** Coordonnées WGS84. Les coordonnées exactes d'un utilisateur ne sont jamais publiques. */
export interface Coordinates {
  lat: number;
  lng: number;
}

/** Profil public : toute la ligne est lisible par n'importe qui, position approximative comprise. */
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

/** Bucket Storage des avatars : lecture publique, écriture dans le dossier `{uid}/` du propriétaire. */
export const AVATAR_BUCKET = "avatars";
/** Doit rester identique à `file_size_limit` du bucket (supabase/migrations). */
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
/** Doit rester identique à `allowed_mime_types` du bucket. Pas de SVG (script embarqué possible). */
export const AVATAR_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type AvatarMimeType = (typeof AVATAR_MIME_TYPES)[number];
