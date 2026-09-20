/** Rayons de recherche proposés à l'utilisateur, en kilomètres. */
export const SEARCH_RADII_KM = [2, 5, 10, 25, 50] as const;
export type SearchRadiusKm = (typeof SEARCH_RADII_KM)[number];

/** Coordonnées WGS84. Les coordonnées exactes d'un utilisateur ne sont jamais publiques. */
export interface Coordinates {
  lat: number;
  lng: number;
}

// Les types de la base seront générés ici par `supabase gen types` (voir docs/database.md).
