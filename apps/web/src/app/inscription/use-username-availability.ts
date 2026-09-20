"use client";

import { isUsernameAvailable } from "@yakila/api";
import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export type UsernameAvailability = "idle" | "checking" | "available" | "taken" | "unknown";

const DEBOUNCE_MS = 400;

/**
 * Vérifie en direct (avec délai) qu'un pseudo est libre. `normalized` est le pseudo déjà validé
 * par `usernameSchema`, ou `null` s'il est vide ou invalide : dans ce cas rien n'est demandé.
 *
 * Confort uniquement : la base reste seule juge (deux inscriptions simultanées peuvent passer ce
 * contrôle). En cas d'échec réseau ou de configuration, le résultat est `unknown` et n'empêche rien.
 * L'état affiché est dérivé (on compare le pseudo vérifié au pseudo saisi), sans `setState` synchrone
 * dans l'effet.
 */
export function useUsernameAvailability(normalized: string | null): UsernameAvailability {
  const [checked, setChecked] = useState<{
    username: string;
    result: "available" | "taken" | "unknown";
  } | null>(null);

  useEffect(() => {
    if (!normalized) return;
    let cancelled = false;

    const timer = setTimeout(async () => {
      let result: "available" | "taken" | "unknown" = "unknown";
      try {
        const { data } = await isUsernameAvailable(createBrowserSupabaseClient(), normalized);
        if (data !== null) result = data ? "available" : "taken";
      } catch {
        // Variables d'environnement absentes ou réseau coupé : on ne bloque pas l'inscription.
      }
      if (!cancelled) setChecked({ username: normalized, result });
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [normalized]);

  if (!normalized) return "idle";
  return checked?.username === normalized ? checked.result : "checking";
}
