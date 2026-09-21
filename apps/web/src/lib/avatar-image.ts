/**
 * Ré-encodage de l'avatar dans le navigateur, avant l'envoi vers le bucket PUBLIC `avatars`.
 *
 * Pourquoi : une photo de téléphone contient des métadonnées EXIF (position GPS, modèle de
 * l'appareil, date) et serait servie telle quelle, à une URL qui contient l'id public de l'utilisateur.
 * Un canvas ne conserve aucune métadonnée : dessiner l'image dessus puis l'exporter les supprime toutes.
 * Effets de bord voulus : image bornée à 512 px, donc quelques dizaines de Ko (plus de refus « 2 Mo »).
 *
 * Fonctions du navigateur (`createImageBitmap`, canvas) : à tester dans un vrai navigateur.
 * Seul `fitWithin` est pur et se teste seul.
 */

export const AVATAR_MAX_SIDE = 512;
export const AVATAR_JPEG_QUALITY = 0.85;
/** JPEG et non WebP : Safari ne sait pas encoder le WebP (`toBlob` renverrait du PNG). */
export const AVATAR_OUTPUT_TYPE = "image/jpeg";
/** Plafond du fichier d'origine : évite de décoder une image démesurée (mémoire du navigateur). */
export const AVATAR_MAX_SOURCE_BYTES = 20 * 1024 * 1024;

export const AVATAR_UNREADABLE_MESSAGE = "Impossible de lire cette image. Essaie une autre photo.";
export const AVATAR_ENCODE_MESSAGE = "Impossible de préparer cette photo. Essaie une autre image.";

export type AvatarImageResult = { ok: true; blob: Blob } | { ok: false; message: string };

/** Réduit `width` x `height` pour que le plus grand côté soit au plus `maxSide`, sans jamais agrandir. */
export function fitWithin(
  width: number,
  height: number,
  maxSide: number,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxSide) return { width, height };
  const scale = maxSide / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * `imageOrientation: "from-image"` applique l'orientation EXIF au décodage : sans lui, une photo
 * prise en portrait serait tournée une fois les métadonnées perdues. Les navigateurs anciens qui
 * ne connaissent pas cette valeur lèvent une erreur : on retente alors sans option.
 */
async function decode(file: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return await createImageBitmap(file);
  }
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, AVATAR_OUTPUT_TYPE, AVATAR_JPEG_QUALITY);
  });
}

/** Ne rejette jamais : retourne le JPEG ré-encodé, ou un message français prêt à afficher. */
export async function reencodeAvatar(file: Blob): Promise<AvatarImageResult> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await decode(file);
  } catch {
    return { ok: false, message: AVATAR_UNREADABLE_MESSAGE };
  }

  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height, AVATAR_MAX_SIDE);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) return { ok: false, message: AVATAR_ENCODE_MESSAGE };

    // Le JPEG n'a pas de transparence : sans fond, un PNG transparent deviendrait noir.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, 0, 0, width, height);

    const blob = await canvasToBlob(canvas);
    // `toBlob` renvoie `null` en cas d'échec, et un autre type si le format demandé n'est pas encodé.
    if (!blob || blob.type !== AVATAR_OUTPUT_TYPE) {
      return { ok: false, message: AVATAR_ENCODE_MESSAGE };
    }
    return { ok: true, blob };
  } catch {
    return { ok: false, message: AVATAR_ENCODE_MESSAGE };
  } finally {
    bitmap.close();
  }
}
