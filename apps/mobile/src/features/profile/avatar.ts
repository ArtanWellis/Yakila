import * as ImagePicker from "expo-image-picker";
import { uploadAvatar } from "@yakila/api";
import { avatarFileSchema } from "@yakila/validation";
import { resolveImageMimeType } from "@/lib/image";
import { supabase } from "@/lib/supabase";

/**
 * Compression JPEG demandée au sélecteur (≤ 0.8). Un avatar s'affiche en petit : 0.6 garde une
 * image nette tout en restant très en dessous de la limite de 2 Mo du bucket.
 */
const AVATAR_PICKER_QUALITY = 0.6;

export type AvatarOutcome =
  | { status: "cancelled" }
  | { status: "updated"; avatarUrl: string }
  | { status: "error"; message: string };

const UPLOAD_ERROR = "Impossible d'envoyer la photo. Vérifie ta connexion et réessaie.";

/**
 * Choisit une photo dans la galerie, la recadre en carré puis l'envoie comme avatar.
 *
 * Le sélecteur système n'a pas besoin de permission d'accès à la galerie pour les images. Le
 * recadrage (`allowsEditing`) est volontairement obligatoire : il ré-encode l'image, ce qui retire
 * en pratique les métadonnées EXIF (dont une éventuelle position GPS) d'une photo destinée à un
 * bucket public.
 */
export async function pickAndUploadAvatar(userId: string): Promise<AvatarOutcome> {
  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: AVATAR_PICKER_QUALITY,
      preferredAssetRepresentationMode:
        ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    });
    const asset = result.canceled ? undefined : result.assets[0];
    if (asset === undefined) return { status: "cancelled" };

    const mimeType = resolveImageMimeType(asset);
    if (mimeType === null) {
      return {
        status: "error",
        message: "Format d'image non reconnu. Formats acceptés : JPEG, PNG, WebP.",
      };
    }

    const body = await (await fetch(asset.uri)).arrayBuffer();

    // Même contrôle que `uploadAvatar` : on le rejoue ici pour afficher le message précis
    // (format ou taille) plutôt qu'une erreur générique.
    const check = avatarFileSchema.safeParse({ type: mimeType, size: body.byteLength });
    if (!check.success) {
      return { status: "error", message: check.error.issues[0]?.message ?? "Image invalide." };
    }

    const { data, error } = await uploadAvatar(supabase, userId, body, mimeType);
    if (error || data === null) return { status: "error", message: UPLOAD_ERROR };
    return { status: "updated", avatarUrl: data };
  } catch {
    return { status: "error", message: UPLOAD_ERROR };
  }
}
