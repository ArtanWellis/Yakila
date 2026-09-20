"use client";

import { uploadAvatar } from "@yakila/api";
import { AVATAR_MAX_BYTES, AVATAR_MIME_TYPES } from "@yakila/types";
import { avatarFileSchema } from "@yakila/validation";
import { useRouter } from "next/navigation";
import { useState, type ChangeEvent } from "react";
import { Avatar } from "@/components/avatar";
import { secondaryButton } from "@/components/button-styles";
import { FormMessage } from "@/components/form-fields";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type Status = { tone: "success" | "error"; message: string } | null;

const GENERIC_ERROR = "Impossible d'envoyer la photo. Réessaie dans un instant.";
const MAX_MB = AVATAR_MAX_BYTES / (1024 * 1024);

/**
 * Envoi de l'avatar directement du navigateur vers Supabase Storage (pas de Server Action : elles
 * sont limitées à 1 Mo par défaut, l'avatar peut peser 2 Mo). Le fichier est contrôlé avant l'envoi
 * avec le schéma partagé ; le bucket applique de toute façon les mêmes limites côté serveur.
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

    const check = avatarFileSchema.safeParse({ type: file.type, size: file.size });
    if (!check.success) {
      setStatus({ tone: "error", message: check.error.issues[0]?.message ?? "Fichier invalide." });
      return;
    }

    setUploading(true);
    setStatus(null);
    try {
      const { error } = await uploadAvatar(createBrowserSupabaseClient(), userId, file, file.type);
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
          JPEG, PNG ou WebP, {MAX_MB} Mo max.
        </p>
        <FormMessage message={status?.message} tone={status?.tone} />
      </div>
    </div>
  );
}
