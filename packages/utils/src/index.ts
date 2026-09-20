/** Formate une distance en français : "850 m", "3,2 km", "12 km". */
export function formatDistanceKm(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  const rounded = km < 10 ? Math.round(km * 10) / 10 : Math.round(km);
  return `${rounded.toLocaleString("fr-FR")} km`;
}
