import { useCallback, useEffect, useState } from "react";
import { fetchProfile } from "@yakila/api";
import type { Profile } from "@yakila/types";
import { supabase } from "@/lib/supabase";
import { REQUEST_TIMEOUT_MS, withTimeout } from "@/lib/timeout";

export type OwnProfileState =
  { status: "loading" } | { status: "error" } | { status: "ready"; profile: Profile };

async function loadProfile(userId: string): Promise<Profile | null> {
  try {
    const { data, error } = await withTimeout(fetchProfile(supabase, userId), REQUEST_TIMEOUT_MS);
    return error ? null : data;
  } catch {
    return null;
  }
}

/**
 * Profil de l'utilisateur connecté. `patch` applique localement un changement déjà enregistré
 * (avatar, formulaire) ; `refresh` relit la ligne sans repasser par l'écran de chargement.
 */
export function useOwnProfile(userId: string) {
  const [state, setState] = useState<OwnProfileState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void loadProfile(userId).then((profile) => {
      if (!cancelled) setState(profile ? { status: "ready", profile } : { status: "error" });
    });
    return () => {
      cancelled = true;
    };
  }, [userId, attempt]);

  const retry = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((count) => count + 1);
  }, []);

  const refresh = useCallback(async () => {
    const profile = await loadProfile(userId);
    if (profile) setState({ status: "ready", profile });
  }, [userId]);

  const patch = useCallback((changes: Partial<Profile>) => {
    setState((previous) =>
      previous.status === "ready"
        ? { status: "ready", profile: { ...previous.profile, ...changes } }
        : previous,
    );
  }, []);

  return { state, retry, refresh, patch };
}
