"use client";

import { clearProfileLocation, setProfileLocation } from "@yakila/api";
import { coordinatesSchema } from "@yakila/validation";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { primaryButton, secondaryButton } from "@/components/button-styles";
import { FormMessage } from "@/components/form-fields";
import { geolocationFailureMessage, getBrowserPosition } from "@/lib/geolocation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type Status = { tone: "success" | "error"; message: string } | null;

const GENERIC_ERROR = "Une erreur est survenue. Réessaie dans un instant.";

/**
 * Position de l'utilisateur. Les coordonnées exactes vont directement du navigateur à Supabase
 * (RPC `set_profile_location`), qui les garde en privé et n'expose qu'une version arrondie (~1 km).
 * Elles ne sont jamais affichées, stockées dans l'état React ni écrites dans la console.
 */
export function LocationControls({ hasLocation }: { hasLocation: boolean }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>(null);
  const [busy, setBusy] = useState(false);

  async function saveLocation() {
    setBusy(true);
    setStatus(null);
    try {
      const position = await getBrowserPosition();
      if (!position.ok) {
        setStatus({ tone: "error", message: geolocationFailureMessage(position.reason) });
        return;
      }
      const coordinates = coordinatesSchema.safeParse(position.coordinates);
      if (!coordinates.success) {
        setStatus({ tone: "error", message: GENERIC_ERROR });
        return;
      }
      const { error } = await setProfileLocation(createBrowserSupabaseClient(), coordinates.data);
      if (error) {
        console.error("[profil] position non enregistrée :", error.code);
        setStatus({ tone: "error", message: GENERIC_ERROR });
        return;
      }
      setStatus({ tone: "success", message: "Position enregistrée." });
      router.refresh();
    } catch {
      setStatus({ tone: "error", message: GENERIC_ERROR });
    } finally {
      setBusy(false);
    }
  }

  async function removeLocation() {
    setBusy(true);
    setStatus(null);
    try {
      const { error } = await clearProfileLocation(createBrowserSupabaseClient());
      if (error) {
        console.error("[profil] position non supprimée :", error.code);
        setStatus({ tone: "error", message: GENERIC_ERROR });
        return;
      }
      setStatus({ tone: "success", message: "Position supprimée." });
      router.refresh();
    } catch {
      setStatus({ tone: "error", message: GENERIC_ERROR });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Seule une position <strong>approximative</strong> (environ 1 km) est visible par les autres.
        Ta position exacte reste privée : elle n&apos;est jamais affichée.
      </p>
      <p className="text-sm font-medium">
        {hasLocation ? "Une position est enregistrée." : "Aucune position enregistrée."}
      </p>

      <div className="flex flex-wrap gap-3">
        <button type="button" className={primaryButton} disabled={busy} onClick={saveLocation}>
          Utiliser ma position
        </button>
        {hasLocation ? (
          <button
            type="button"
            className={secondaryButton}
            disabled={busy}
            onClick={removeLocation}
          >
            Supprimer ma position
          </button>
        ) : null}
      </div>

      <FormMessage message={status?.message} tone={status?.tone} />
    </div>
  );
}
