import * as Location from "expo-location";
import { clearProfileLocation, setProfileLocation } from "@yakila/api";
import { coordinatesSchema } from "@yakila/validation";
import { supabase } from "@/lib/supabase";
import { REQUEST_TIMEOUT_MS, withTimeout } from "@/lib/timeout";

/** Un premier fix peut être long à l'intérieur d'un bâtiment : au-delà, on abandonne. */
const POSITION_TIMEOUT_MS = 15_000;

export type SaveLocationOutcome =
  | { status: "saved" }
  /** L'utilisateur a refusé l'explication préalable. */
  | { status: "cancelled" }
  /** Refus dans la boîte de dialogue du système. */
  | { status: "denied" }
  /** Refus déjà enregistré : le système ne redemandera plus, seuls les réglages permettent de changer. */
  | { status: "blocked" }
  | { status: "services-disabled" }
  | { status: "unavailable" }
  | { status: "error" };

type PermissionOutcome = "granted" | "cancelled" | "denied" | "blocked";

/**
 * Permission de localisation au premier plan uniquement (jamais en arrière-plan). Elle n'est
 * demandée qu'ici, sur un tap explicite, après `confirmRationale` qui explique l'usage.
 */
async function ensureForegroundPermission(
  confirmRationale: () => Promise<boolean>,
): Promise<PermissionOutcome> {
  const current = await Location.getForegroundPermissionsAsync();
  if (current.granted) return "granted";
  if (!current.canAskAgain) return "blocked";
  if (!(await confirmRationale())) return "cancelled";

  const requested = await Location.requestForegroundPermissionsAsync();
  return requested.granted ? "granted" : "denied";
}

/**
 * Lit la position et l'envoie à la base (`set_profile_location`), qui range l'exacte dans la table
 * privée et n'expose qu'une version arrondie (environ 1 km).
 *
 * Les coordonnées restent dans des variables locales : elles ne sont ni gardées dans l'état de
 * l'application, ni affichées, ni journalisées.
 */
export async function saveMyApproximateLocation(
  confirmRationale: () => Promise<boolean>,
): Promise<SaveLocationOutcome> {
  try {
    const permission = await ensureForegroundPermission(confirmRationale);
    if (permission !== "granted") return { status: permission };

    if (!(await Location.hasServicesEnabledAsync())) return { status: "services-disabled" };

    let latitude: number;
    let longitude: number;
    try {
      const position = await withTimeout(
        // Précision « basse » (~1 km) : la position publique est arrondie à ~1 km, inutile de
        // demander plus fin (et moins de données de localisation collectées).
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }),
        POSITION_TIMEOUT_MS,
      );
      ({ latitude, longitude } = position.coords);
    } catch {
      return { status: "unavailable" };
    }

    const coordinates = coordinatesSchema.safeParse({ lat: latitude, lng: longitude });
    if (!coordinates.success) return { status: "unavailable" };

    const { error } = await withTimeout(
      setProfileLocation(supabase, coordinates.data),
      REQUEST_TIMEOUT_MS,
    );
    return error ? { status: "error" } : { status: "saved" };
  } catch {
    return { status: "error" };
  }
}

/** Efface la position, exacte et approximative. `true` si la suppression a réussi. */
export async function removeMyLocation(): Promise<boolean> {
  try {
    const { error } = await withTimeout(clearProfileLocation(supabase), REQUEST_TIMEOUT_MS);
    return error === null;
  } catch {
    return false;
  }
}
