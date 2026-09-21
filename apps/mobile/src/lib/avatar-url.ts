// `isTrustedAvatarUrl` utilise `new URL()` : l'implémentation native de React Native est incomplète
// (`origin`, `pathname`…). Le polyfill est idempotent, on l'importe ici pour ne pas dépendre de
// l'ordre de chargement des modules.
import "react-native-url-polyfill/auto";

import { isTrustedAvatarUrl } from "@yakila/api";

/**
 * Vrai si `uri` pointe vers le bucket `avatars` de NOTRE projet Supabase.
 *
 * 1. `isTrustedAvatarUrl` (partagé avec le web) : même origine, chemin du bucket.
 * 2. La chaîne brute doit commencer EXACTEMENT par `<origine>/`. Garde-fou contre les différences
 *    d'analyse : selon WHATWG, `https://x@evil.example@notre-hote/…` désigne notre hôte (tout ce qui
 *    précède le dernier `@` est du « userinfo »), mais l'analyseur natif qui charge réellement
 *    l'image (iOS, Android) n'est pas forcé de couper au même `@`. Une URL légitime, produite par
 *    `getPublicUrl` à partir de la même adresse, ne contient jamais d'identifiants.
 */
export function isAvatarUriFromOurBucket(uri: string, supabaseUrl: string | undefined): boolean {
  if (!isTrustedAvatarUrl(uri, supabaseUrl)) return false;
  try {
    return uri.startsWith(`${new URL(supabaseUrl ?? "").origin}/`);
  } catch {
    return false;
  }
}

/**
 * `uri` telle quelle si elle vient de notre bucket, sinon `null` (le composant affiche alors les
 * initiales). La base impose la forme du chemin mais pas le domaine : sans ce contrôle, une URL
 * externe permettrait de tracer (IP, User-Agent) les visiteurs d'un profil.
 */
export function trustedAvatarUri(uri: string | null): string | null {
  if (uri === null) return null;
  // Valeur littérale : Expo ne remplace `process.env.EXPO_PUBLIC_*` qu'écrit tel quel.
  return isAvatarUriFromOurBucket(uri, process.env.EXPO_PUBLIC_SUPABASE_URL) ? uri : null;
}
