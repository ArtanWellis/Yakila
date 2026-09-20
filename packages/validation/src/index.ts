import { z } from "zod";
import { AVATAR_MAX_BYTES, AVATAR_MIME_TYPES, SEARCH_RADII_KM } from "@yakila/types";

export const coordinatesSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const searchRadiusSchema = z
  .number()
  .refine((km): km is (typeof SEARCH_RADII_KM)[number] => SEARCH_RADII_KM.some((r) => r === km), {
    message: "Rayon de recherche invalide",
  });

/** Doit rester identique à la contrainte `profiles_username_format` (supabase/migrations). */
export const USERNAME_PATTERN = /^[a-z0-9_]{3,30}$/;

/** Pseudo unique, normalisé en minuscules. L'unicité est garantie par la base, pas par ce schéma. */
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(USERNAME_PATTERN, "3 à 30 caractères : lettres minuscules, chiffres et _");

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email("Adresse e-mail invalide"));

/** Longueur en octets UTF-8, sans `TextEncoder` (pas garanti partout côté React Native). */
function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
  }
  return bytes;
}

/** bcrypt (Supabase Auth) ignore tout ce qui dépasse 72 OCTETS : accents et emoji en comptent plusieurs. */
export const PASSWORD_MAX_BYTES = 72;

/** 8 caractères minimum, 72 octets maximum. */
export const passwordSchema = z
  .string()
  .min(8, "8 caractères minimum")
  .refine((value) => utf8ByteLength(value) <= PASSWORD_MAX_BYTES, {
    message:
      "Mot de passe trop long (72 octets maximum, les accents et emoji en comptent plusieurs)",
  });

export const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  username: usernameSchema,
});
export type SignUpInput = z.output<typeof signUpSchema>;

/** À la connexion on ne rejoue pas les règles de force : un ancien mot de passe doit pouvoir passer. */
export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Mot de passe requis"),
});
export type SignInInput = z.output<typeof signInSchema>;

/** Doivent rester identiques aux contraintes `char_length` de `profiles` (supabase/migrations). */
export const DISPLAY_NAME_MAX = 50;
export const BIO_MAX = 500;
export const CITY_MAX = 100;

/** Texte de formulaire : espaces retirés, chaîne vide enregistrée comme `null`. */
function optionalText(max: number) {
  return z
    .string()
    .trim()
    .max(max, `${max} caractères maximum`)
    .transform((value) => (value === "" ? null : value));
}

/**
 * Champs modifiables du profil. Le formulaire envoie toujours les trois champs.
 * Hors périmètre : `username` (immuable), `avatar_url` (upload dédié), position (RPC dédiée).
 */
export const updateProfileSchema = z.object({
  displayName: optionalText(DISPLAY_NAME_MAX),
  bio: optionalText(BIO_MAX),
  city: optionalText(CITY_MAX),
});
export type UpdateProfileInput = z.output<typeof updateProfileSchema>;

/** Contrôle du fichier avant upload ; le bucket refuse de toute façon ce qui dépasse ces limites. */
export const avatarFileSchema = z.object({
  type: z.enum(AVATAR_MIME_TYPES, { error: "Formats acceptés : JPEG, PNG, WebP" }),
  // Messages en français : ils s'affichent tels quels dans les formulaires (web et mobile).
  size: z
    .number({ error: "Fichier invalide" })
    .int("Fichier invalide")
    .positive("Le fichier est vide")
    .max(AVATAR_MAX_BYTES, `${AVATAR_MAX_BYTES / (1024 * 1024)} Mo maximum`),
});
