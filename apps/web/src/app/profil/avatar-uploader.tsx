"use client";

import { uploadAvatar } from "@yakila/api";
import { AVATAR_MIME_TYPES } from "@yakila/types";
import { avatarFileSchema } from "@yakila/validation";
import { useRouter } from "next/navigation";
import { useState, type ChangeEvent } from "react";
import { Avatar } from "@/components/avatar";
import { secondaryButton } from "@/components/button-styles";
import { FormMessage } from "@/components/form-fields";
import { AVATAR_MAX_SOURCE_BYTES, AVATAR_OUTPUT_TYPE, reencodeAvatar } from "@/lib/avatar-image";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type Status = { tone: "success" | "error"; message: string } | null;

const GENERIC_ERROR = "Impossible d'envoyer la photo. Réessaie dans un instant.";
const SOURCE_TOO_LARGE = `Photo trop lourde (${AVATAR_MAX_SOURCE_BYTES / (1024 * 1024)} Mo maximum).`;

/**
 * Envoi de l'avatar directement du navigateur vers Supabase Storage (pas de Server Action : elles
 * sont limitées à 1 Mo par défaut). Trois contrôles :
 * 1. avant tout : le format du fichier choisi (schéma partagé) et un plafond de poids généreux ;
 * 2. l'image est ré-encodée en JPEG 512 px (`reencodeAvatar`) : cela supprime les métadonnées EXIF
 *    (dont le GPS), l'avatar étant servi publiquement, et ramène le poids sous la limite du bucket ;
 * 3. le JPEG obtenu repasse par le schéma partagé, puis `uploadAvatar` le valide une dernière fois.
 * Le bucket applique de toute façon ses propres limites côté serveur.
 */
export function AvatarUploader({
  userId,
  avatarUrl,
  name,
}: {
  userId: string;
  avatarUrl: string | null;
  name: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>(null);
  const [uploading, setUploading] = useState(false);

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = ""; // permet de choisir à nouveau le même fichier après une erreur
    if (!file) return;

    // 1. Format du fichier d'origine (le poids est celui du JPEG final, pas de la photo brute).
    const sourceType = avatarFileSchema.shape.type.safeParse(file.type);
    if (!sourceType.success) {
      setStatus({
        tone: "error",
        message: sourceType.error.issues[0]?.message ?? "Fichier invalide.",
      });
      return;
    }
    if (file.size > AVATAR_MAX_SOURCE_BYTES) {
      setStatus({ tone: "error", message: SOURCE_TOO_LARGE });
      return;
    }

    setUploading(true);
    setStatus(null);
    try {
      // 2. Ré-encodage : plus aucune métadonnée, orientation appliquée, 512 px maximum.
      const image = await reencodeAvatar(file);
      if (!image.ok) {
        setStatus({ tone: "error", message: image.message });
        return;
      }

      // 3. Contrôle de ce qui va réellement être envoyé.
      const check = avatarFileSchema.safeParse({ type: image.blob.type, size: image.blob.size });
      if (!check.success) {
        setStatus({
          tone: "error",
          message: check.error.issues[0]?.message ?? "Fichier invalide.",
        });
        return;
      }

      const { error } = await uploadAvatar(
        createBrowserSupabaseClient(),
        userId,
        image.blob,
        AVATAR_OUTPUT_TYPE,
      );
      if (error) {
        console.error("[profil] avatar non envoyé :", error.message);
        setStatus({ tone: "error", message: GENERIC_ERROR });
        return;
      }
      setStatus({ tone: "success", message: "Photo mise à jour." });
      router.refresh();
    } catch {
      setStatus({ tone: "error", message: GENERIC_ERROR });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar url={avatarUrl} name={name} size={96} />
      <div className="flex min-w-0 flex-col gap-2">
        <input
          id="avatar"
          type="file"
          accept={AVATAR_MIME_TYPES.join(",")}
          className="peer sr-only"
          disabled={uploading}
          onChange={handleChange}
        />
        {/* Le vrai champ est masqué visuellement : le libellé sert de bouton, avec l'anneau de focus du champ. */}
        <label
          htmlFor="avatar"
          className={`${secondaryButton} cursor-pointer peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-emerald-700 peer-disabled:opacity-60`}
        >
          {uploading ? "Envoi…" : "Changer la photo"}
        </label>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          JPEG, PNG ou WebP. La photo est redimensionnée automatiquement.
        </p>
        <FormMessage message={status?.message} tone={status?.tone} />
      </div>
    </div>
  );
}
