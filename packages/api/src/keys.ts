/**
 * Détecte une clé qui ne doit jamais atteindre un client : `sb_secret_…` (nouveau format)
 * ou un JWT dont le rôle est `service_role` (ancien format).
 */
export function isServiceRoleKey(key: string): boolean {
  if (key.startsWith("sb_secret_")) return true;
  const payload = key.split(".")[1];
  if (!payload) return false;
  try {
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return (JSON.parse(json) as { role?: unknown }).role === "service_role";
  } catch {
    return false;
  }
}
