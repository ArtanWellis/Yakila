import type { Profile } from "@yakila/types";

/** Uniquement les champs publics utiles au SEO : ni identifiant ni position. */
type PublicProfileFields = Pick<Profile, "username" | "display_name" | "bio" | "city">;

const DESCRIPTION_MAX_LENGTH = 160;

export function profileName(profile: Pick<Profile, "username" | "display_name">): string {
  return profile.display_name ?? profile.username;
}

/** "Marie D. (@marie_d)", ou "@marie_d" quand le nom affiché est le pseudo. */
export function profileTitle(profile: PublicProfileFields): string {
  const name = profileName(profile);
  return name === profile.username ? `@${profile.username}` : `${name} (@${profile.username})`;
}

/** La bio (sur une ligne, tronquée) si elle existe, sinon une phrase construite avec le nom et la ville. */
export function profileDescription(profile: PublicProfileFields): string {
  const bio = profile.bio?.replace(/\s+/g, " ").trim();
  if (bio) {
    // Par caractères et non par unités UTF-16 : `slice` couperait un emoji en deux (caractère invalide).
    const characters = Array.from(bio);
    return characters.length > DESCRIPTION_MAX_LENGTH
      ? `${characters
          .slice(0, DESCRIPTION_MAX_LENGTH - 1)
          .join("")
          .trimEnd()}…`
      : bio;
  }
  const where = profile.city ? ` à ${profile.city}` : "";
  return `Profil de ${profileName(profile)}${where} sur YaKiLa.`;
}
