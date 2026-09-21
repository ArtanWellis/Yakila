import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { uploadAvatar } from "@yakila/api";
import { avatarFileSchema } from "@yakila/validation";
import { resizeToFit } from "@/lib/image";
import { supabase } from "@/lib/supabase";
import { UPLOAD_TIMEOUT_MS, withTimeout } from "@/lib/timeout";

/** Un avatar s'affiche en petit : 512 px de plus grand côté suffisent, même sur un écran dense. */
const AVATAR_MAX_SIDE = 512;
const AVATAR_JPEG_QUALITY = 0.8;
/** L'image est toujours envoyée en JPEG, quel que soit son format d'origine (voir `reencodeAsJpeg`). */
const AVATAR_CONTENT_TYPE = "image/jpeg";

export type AvatarOutcome =
  | { status: "cancelled" }
  | { status: "updated"; avatarUrl: string }
  | { status: "error"; message: string };

const PROCESSING_ERROR = "Impossible de traiter cette image. Choisis-en une autre.";
const UPLOAD_ERROR = "Impossible d'envoyer la photo. Vérifie ta connexion et réessaie.";

interface PickedAsset {
  uri: string;
  width: number;
  height: number;
}

/**
 * Ré-encode l'image en JPEG, à 512 px maximum.
 *
 * Ce n'est pas cosmétique : le bucket `avatars` est PUBLIC et l'URL contient l'id de l'utilisateur.
 * Le recadrage du sélecteur ne garantit pas de ré-encodage (selon la plateforme et le format,
 * l'original peut être renvoyé tel quel), donc un JPEG pris avec le GPS activé pourrait publier
 * l'endroit de la prise de vue. `expo-image-manipulator` décode l'image en pixels puis en écrit une
 * nouvelle (`Bitmap.compress` sur Android, `UIImage.jpegData` sur iOS) : aucune métadonnée n'est
 * recopiée, et `SaveOptions` n'offre pas d'option `exif` pour en conserver. L'orientation est
 * aplatie dans les pixels. Effet de bord voulu : un PNG lourd devient un JPEG léger, sous la
 * limite de 2 Mo du bucket ; une transparence est remplacée par du noir.
 *
 * API SDK 57 : `manipulate` → `renderAsync` → `saveAsync` (`manipulateAsync` est déprécié).
 */
async function reencodeAsJpeg(asset: PickedAsset): Promise<string> {
  const context = ImageManipulator.manipulate(asset.uri);
  try {
    let { width, height } = asset;
    if (!(width > 0 && height > 0)) {
      // Le sélecteur peut renvoyer 0 quand il ignore les dimensions : on les lit après décodage.
      const decoded = await context.renderAsync();
      ({ width, height } = decoded);
      decoded.release();
    }

    const size = resizeToFit(width, height, AVATAR_MAX_SIDE);
    if (size !== null) context.resize(size);

    const image = await context.renderAsync();
    try {
      const saved = await image.saveAsync({
        format: SaveFormat.JPEG,
        compress: AVATAR_JPEG_QUALITY,
      });
      return saved.uri;
    } finally {
      image.release();
    }
  } finally {
    context.release();
  }
}

/**
 * Choisit une photo dans la galerie, la recadre en carré, la ré-encode (voir `reencodeAsJpeg`)
 * puis l'envoie comme avatar. Le sélecteur système n'a pas besoin de permission d'accès à la
 * galerie pour les images.
 */
export async function pickAndUploadAvatar(userId: string): Promise<AvatarOutcome> {
  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      // Le ré-encodage final fixe la qualité ; ici on évite juste de traîner une image énorme.
      quality: AVATAR_JPEG_QUALITY,
      preferredAssetRepresentationMode:
        ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    });
    const asset = result.canceled ? undefined : result.assets[0];
    if (asset === undefined) return { status: "cancelled" };

    let jpegUri: string;
    try {
      jpegUri = await reencodeAsJpeg(asset);
    } catch {
      return { status: "error", message: PROCESSING_ERROR };
    }

    const body = await (await fetch(jpegUri)).arrayBuffer();

    // Même contrôle que `uploadAvatar` : on le rejoue ici pour afficher le message précis plutôt
    // qu'une erreur générique.
    const check = avatarFileSchema.safeParse({ type: AVATAR_CONTENT_TYPE, size: body.byteLength });
    if (!check.success) {
      return { status: "error", message: check.error.issues[0]?.message ?? "Image invalide." };
    }

    // Le délai dépassé tombe dans le `catch` ci-dessous : message d'envoi, bouton de nouveau utilisable.
    const { data, error } = await withTimeout(
      uploadAvatar(supabase, userId, body, AVATAR_CONTENT_TYPE),
      UPLOAD_TIMEOUT_MS,
    );
    if (error || data === null) return { status: "error", message: UPLOAD_ERROR };
    return { status: "updated", avatarUrl: data };
  } catch {
    return { status: "error", message: UPLOAD_ERROR };
  }
}
