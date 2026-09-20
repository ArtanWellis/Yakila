const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

interface PickedImage {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
}

/**
 * Type MIME d'une image choisie dans la galerie. `mimeType` peut manquer selon la plateforme : on se
 * rabat alors sur l'extension. Retourne `null` si rien ne permet de le savoir. La valeur n'est pas
 * filtrée ici : `avatarFileSchema` (@yakila/validation) décide des formats acceptés.
 */
export function resolveImageMimeType(image: PickedImage): string | null {
  const declared = image.mimeType?.trim().toLowerCase();
  if (declared) return declared === "image/jpg" ? "image/jpeg" : declared;

  const name = (image.fileName ?? image.uri).split(/[?#]/)[0] ?? "";
  const dot = name.lastIndexOf(".");
  if (dot === -1) return null;
  return MIME_BY_EXTENSION[name.slice(dot + 1).toLowerCase()] ?? null;
}
