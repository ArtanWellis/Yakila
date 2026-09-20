import { fetchProfileByUsername } from "@yakila/api";
import { cache } from "react";
import { createPublicSupabaseClient } from "@/lib/supabase/public";

/**
 * Profil public par pseudo, via le client anonyme (rien de privé, rendu indépendant du visiteur).
 * Mémoïsé le temps d'un rendu : `generateMetadata` et la page partagent une seule requête.
 */
export const getPublicProfile = cache(async (username: string) =>
  fetchProfileByUsername(createPublicSupabaseClient(), username),
);
