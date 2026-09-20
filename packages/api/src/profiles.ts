import type { SupabaseClient } from "@supabase/supabase-js";
import { AVATAR_BUCKET, type Coordinates, type Database } from "@yakila/types";
import { avatarFileSchema, type UpdateProfileInput } from "@yakila/validation";

/**
 * Accès aux profils, partagé par le web et le mobile. Le client est passé en paramètre : c'est
 * `createSupabaseClient` sur mobile, `@supabase/ssr` sur le web (même type `SupabaseClient<Database>`).
 * Les requêtes retournent la réponse Supabase brute (`{ data, error }`) ; à l'appelant de la traiter.
 */
type Client = SupabaseClient<Database>;

export function fetchProfile(client: Client, id: string) {
  return client.from("profiles").select("*").eq("id", id).maybeSingle();
}

export function fetchProfileByUsername(client: Client, username: string) {
  return client.from("profiles").select("*").eq("username", username).maybeSingle();
}

/**
 * Indique si le pseudo est libre. Simple confort d'interface : seule la contrainte d'unicité
 * de la base fait foi (deux inscriptions simultanées peuvent passer ce contrôle).
 * `data` vaut `null` (inconnu) en cas d'erreur, ou si la réponse ne contient pas de total
 * (en-tête `Content-Range` perdu en chemin) : ne jamais annoncer « pseudo pris » à tort.
 */
export async function isUsernameAvailable(client: Client, username: string) {
  const { count, error } = await client
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("username", username);
  return { data: error || count === null ? null : count === 0, error };
}

/** Met à jour les champs texte du profil de l'utilisateur connecté (la RLS l'impose aussi). */
export function updateOwnProfile(client: Client, userId: string, input: UpdateProfileInput) {
  return client
    .from("profiles")
    .update({ display_name: input.displayName, bio: input.bio, city: input.city })
    .eq("id", userId)
    .select()
    .single();
}

/** Enregistre la position exacte (privée) et sa version arrondie (publique), côté base. */
export function setProfileLocation(client: Client, coordinates: Coordinates) {
  return client.rpc("set_profile_location", { p_lat: coordinates.lat, p_lng: coordinates.lng });
}

/** Efface la position, exacte et approximative. */
export function clearProfileLocation(client: Client) {
  return client.rpc("clear_profile_location");
}

/** Chemin de l'avatar dans le bucket : le premier dossier est l'id de l'utilisateur (policy Storage). */
export function avatarObjectPath(userId: string) {
  return `${userId}/avatar`;
}

/**
 * N'affiche un avatar que s'il vient du bucket `avatars` de NOTRE projet Supabase. La base impose
 * la forme du chemin (contrainte `profiles_avatar_url_format`) mais pas le nom d'hôte, qu'elle ne
 * connaît pas : sans ce contrôle, un utilisateur pourrait enregistrer une URL externe au bon format
 * et faire charger n'importe quelle image (pixel espion, contenu illicite) à ses visiteurs.
 * À appeler avant tout affichage d'un `avatar_url`, sur le web comme sur le mobile.
 */
export function isTrustedAvatarUrl(
  avatarUrl: string,
  supabaseUrl: string | undefined | null,
): boolean {
  if (!supabaseUrl) return false;
  try {
    const avatar = new URL(avatarUrl);
    const supabase = new URL(supabaseUrl);
    return (
      avatar.origin === supabase.origin &&
      avatar.pathname.startsWith(`/storage/v1/object/public/${AVATAR_BUCKET}/`)
    );
  } catch {
    return false;
  }
}

/**
 * Envoie l'avatar puis enregistre son URL publique dans le profil. Le fichier est écrasé à chaque
 * envoi, `?v=` évite que le CDN ou le navigateur serve l'ancienne image.
 * Retourne l'URL enregistrée dans `data`.
 */
export async function uploadAvatar(
  client: Client,
  userId: string,
  body: Blob | ArrayBuffer,
  contentType: string,
) {
  const size = body instanceof ArrayBuffer ? body.byteLength : body.size;
  const check = avatarFileSchema.safeParse({ type: contentType, size });
  if (!check.success) {
    return { data: null, error: new Error(check.error.issues[0]?.message ?? "Fichier invalide") };
  }

  const path = avatarObjectPath(userId);
  const bucket = client.storage.from(AVATAR_BUCKET);
  const { error: uploadError } = await bucket.upload(path, body, { contentType, upsert: true });
  if (uploadError) return { data: null, error: uploadError };

  const avatarUrl = `${bucket.getPublicUrl(path).data.publicUrl}?v=${Date.now()}`;
  const { error } = await client
    .from("profiles")
    .update({ avatar_url: avatarUrl })
    .eq("id", userId);
  return { data: error ? null : avatarUrl, error };
}
