import type { Coordinates } from "@yakila/types";

export type GeolocationFailure = "unsupported" | "denied" | "unavailable" | "timeout";

export type PositionResult =
  { ok: true; coordinates: Coordinates } | { ok: false; reason: GeolocationFailure };

/** Codes de `GeolocationPositionError` (1 = refusé, 2 = indisponible, 3 = délai dépassé). */
function failureFromCode(code: number): GeolocationFailure {
  if (code === 1) return "denied";
  if (code === 3) return "timeout";
  return "unavailable";
}

/**
 * Position du navigateur, à appeler sur un geste de l'utilisateur (le navigateur demande alors
 * l'autorisation). Ne rejette jamais. Précision « ville » suffisante : pas de GPS haute précision.
 * Les coordonnées ne doivent être ni affichées ni journalisées : elles partent directement vers
 * la RPC `set_profile_location`.
 */
export function getBrowserPosition(): Promise<PositionResult> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      resolve({ ok: false, reason: "unsupported" });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          ok: true,
          coordinates: { lat: position.coords.latitude, lng: position.coords.longitude },
        }),
      (error) => resolve({ ok: false, reason: failureFromCode(error.code) }),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  });
}

export function geolocationFailureMessage(reason: GeolocationFailure): string {
  switch (reason) {
    case "unsupported":
      return "Ton navigateur ne permet pas la localisation. Indique plutôt ta ville.";
    case "denied":
      return "Localisation refusée. Autorise-la dans les réglages de ton navigateur, ou indique simplement ta ville.";
    case "timeout":
      return "La localisation a pris trop de temps. Réessaie.";
    case "unavailable":
      return "Position introuvable pour le moment. Réessaie, ou indique simplement ta ville.";
  }
}
