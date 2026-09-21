/**
 * Dimension à demander au manipulateur pour qu'un plus grand côté ne dépasse pas `maxSide`, en
 * conservant les proportions (le côté non précisé est calculé par le manipulateur). `null` : rien à
 * redimensionner, car l'image tient déjà (jamais d'agrandissement) ou ses dimensions sont inconnues.
 */
export function resizeToFit(
  width: number,
  height: number,
  maxSide: number,
): { width: number } | { height: number } | null {
  if (!(width > 0 && height > 0)) return null;
  if (Math.max(width, height) <= maxSide) return null;
  return width >= height ? { width: maxSide } : { height: maxSide };
}
