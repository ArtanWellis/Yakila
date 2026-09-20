/** Palette et espacements minimaux de la phase 1. Contrastes vérifiés pour du texte sur fond blanc. */
export const colors = {
  background: "#ffffff",
  surface: "#f4f4f5",
  text: "#18181b",
  textMuted: "#52525b",
  border: "#a1a1aa",
  primary: "#4338ca",
  onPrimary: "#ffffff",
  danger: "#b91c1c",
  success: "#15803d",
} as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;

/** Taille minimale d'une zone tactile (Apple : 44 pt, Material : 48 dp). */
export const MIN_TOUCH_SIZE = 48;
