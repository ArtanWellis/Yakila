import { useCallback, useEffect, useState } from "react";
import { fetchProfileByUsername } from "@yakila/api";
import type { Profile } from "@yakila/types";
import { supabase } from "@/lib/supabase";
import { REQUEST_TIMEOUT_MS, withTimeout } from "@/lib/timeout";

type Outcome =
  { status: "ready"; profile: Profile } | { status: "not-found" } | { status: "error" };

export type PublicProfileState = { status: "loading" } | Outcome;

async function loadByUsername(username: string): Promise<Outcome> {
  try {
    const { data, error } = await withTimeout(
      fetchProfileByUsername(supabase, username),
      REQUEST_TIMEOUT_MS,
    );
    if (error) return { status: "error" };
    return data ? { status: "ready", profile: data } : { status: "not-found" };
  } catch {
    return { status: "error" };
  }
}

/**
 * Profil public d'un pseudo. `username` doit déjà être validé et normalisé (`usernameSchema`) ;
 * `null` signifie « pseudo invalide » et donne directement `not-found`, sans requête.
 * Le résultat est rangé avec le pseudo et la tentative qu'il concerne : pendant un changement de
 * pseudo ou un « Réessayer », l'état repasse à `loading` au lieu d'afficher un résultat périmé.
 */
export function usePublicProfile(username: string | null) {
  const [attempt, setAttempt] = useState(0);
  const [settled, setSettled] = useState<{
    username: string;
    attempt: number;
    outcome: Outcome;
  } | null>(null);

  useEffect(() => {
    if (username === null) return;
    let cancelled = false;
    void loadByUsername(username).then((outcome) => {
      if (!cancelled) setSettled({ username, attempt, outcome });
    });
    return () => {
      cancelled = true;
    };
  }, [username, attempt]);

  const retry = useCallback(() => setAttempt((count) => count + 1), []);

  let state: PublicProfileState = { status: "loading" };
  if (username === null) state = { status: "not-found" };
  else if (settled?.username === username && settled.attempt === attempt) state = settled.outcome;

  return { state, retry };
}
