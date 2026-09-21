# Sécurité

## Règles

- RLS sur chaque table, policies testées. Aucun accès aux données privées d'autrui en modifiant une requête frontend.
- Jamais de service role key côté client ; jamais de secret dans le repo. `.gitignore` exclut `.env*` sauf `.env.example`.
- Variables préfixées `NEXT_PUBLIC_` / `EXPO_PUBLIC_` = publiques (embarquées dans le bundle). Seule la clé anon (ou publishable) y a sa place.
- `packages/api` n'accepte que l'URL et la clé anon : `createSupabaseClient` **refuse à l'exécution** une clé `sb_secret_…` ou un JWT `service_role`
  (le web refuse la même chose dans `apps/web/src/lib/supabase/env.ts`, via `isServiceRoleKey` de `@yakila/api`).
- Coordonnées exactes jamais exposées publiquement.
- Validation côté serveur (schémas Zod de `packages/validation`) : les server actions du web re-valident tout, on ne fait jamais confiance au client.

## Mesures en place (phase 1)

**Base de données** (détail dans [database.md](database.md)) : RLS et grants explicites ; `username` immuable et `approx_*` non modifiables directement (privilèges de colonnes) ;
position exacte dans une table séparée sans aucune voie d'écriture cliente ; RPC `security definer` avec `search_path` vide ; trigger d'inscription qui valide le pseudo venant du client ;
fonctions de trigger dans le schéma `private` non exposé ; policies Storage limitées à l'objet `{uid}/avatar` ; `avatar_url` contraint (forme et 300 caractères).

**Web** : cookies de session `Secure` en production ; en-têtes `Content-Security-Policy` partielle (`frame-ancestors 'none'`, `object-src 'none'`, `base-uri`, `form-action`, `img-src`),
`Strict-Transport-Security` (production), `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` ; pas de `X-Powered-By` ; redirection `next` limitée aux chemins locaux (`safeNextPath`) ;
message de connexion générique et message d'inscription qui ne confirme pas l'existence d'un compte ; `getClaims()` dans le proxy (contrôle optimiste, les pages et actions revalident) ;
déconnexion `scope: "local"` ; pages privées en `noindex`.

**Avatars** : l'image est ré-encodée avant l'envoi (canvas 512 px JPEG sur le web, `expo-image-manipulator` sur le mobile), ce qui retire l'EXIF/GPS d'un fichier destiné à un bucket public.
`isTrustedAvatarUrl` (`@yakila/api`) n'autorise l'affichage que d'une image de notre propre projet Supabase, sur le web comme sur le mobile (le web restreint aussi `images.remotePatterns`).

**Mobile** : session dans `expo-secure-store` (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`, valeurs découpées en morceaux avec manifeste validé), permission de localisation demandée au tap (premier plan seulement, précision basse),
coordonnées jamais stockées, affichées ni journalisées, paramètres de deep link validés par Zod, délais d'attente sur les appels réseau.

## Revue de la phase 1

Deux relectures indépendantes (sécurité, QA) ont eu lieu avant le premier push des migrations. Aucune vérification n'a pu être faite contre une base réelle :
les policies ont été relues à la main, avec `supabase/tests/manual/phase1-rls-checks.sql` à exécuter après le push.

Corrigé : EXIF/GPS dans les avatars (web et mobile), cookies sans `Secure`, en-têtes de sécurité absents (sauf `script-src`), hôte externe pour `avatar_url` côté clients,
`avatar_url` sans limite de longueur, message d'inscription qui confirmait l'existence d'un compte, mot de passe compté en caractères au lieu d'octets (limite bcrypt), pseudo « déjà pris » affiché à tort,
impossibilité de renvoyer l'e-mail de confirmation, appels réseau mobiles sans délai d'attente.

**Encore ouvert** :

| Sujet                                                                                           | Gravité           | Où en est-on                                                                                                             |
| ----------------------------------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Lecture publique complète de `profiles` (aspiration par `anon`)                                 | Moyenne           | Décision à prendre, voir [database.md](database.md#points-ouverts-décisions-à-prendre-pas-des-bugs)                      |
| Pseudos réservés, profil public avant confirmation d'e-mail                                     | Moyenne           | Décision à prendre ; CAPTCHA et purge des comptes non confirmés avant le lancement                                       |
| Échec du trigger qui pourrait révéler l'existence d'un e-mail                                   | Moyenne (soupçon) | À vérifier sur le projet ; piste : trigger qui n'échoue jamais                                                           |
| Réglages Auth du projet cloud (confirmation d'e-mail, mot de passe 8, redirects, SMTP, CAPTCHA) | Moyenne           | Non versionnés : checklist dans [database.md](database.md#réglages-du-dashboard-supabase-hors-migrations-non-versionnés) |
| Pas de `script-src` dans la CSP                                                                 | Basse             | Un nonce forcerait le rendu dynamique de toutes les pages ; à revoir en phase 10 (SRI, cache)                            |
| Lien de confirmation consommé en GET (login CSRF, scanners de liens)                            | Basse             | Passer par une page avec bouton POST si le cas se présente                                                               |
| Contenu réel des fichiers Storage non contrôlé (seul le `Content-Type` déclaré l'est)           | Basse             | Modération (phase 9) et ré-encodage serveur                                                                              |
| Limites de débit d'Auth vues du serveur (IP du serveur Next)                                    | Basse             | CAPTCHA et transmission de l'IP cliente avant le lancement                                                               |
| Chaînes iOS « Always » de la localisation conservées                                            | Basse             | Retirables via les options du plugin `expo-location` ; à valider au premier upload TestFlight                            |

## RGPD

À traiter avant le lancement (rien de tout cela n'existe en phase 1) :

- **Suppression de compte** : fonction serveur (service role côté serveur uniquement) qui supprime l'avatar (API Storage), la position exacte, puis le compte en suppression définitive.
- **Consentement** : CGU et politique de confidentialité, âge minimum (15 ans en France), à l'inscription web et mobile. Les pages légales n'existent pas encore.
- **Minimisation** : la position exacte (`profile_private`) est stockée sans usage avant la phase 3 ; la recherche par rayon devra utiliser la position approximative (une recherche sur l'exacte permettrait de la retrouver par trilatération).
- **Lecture publique des profils** : arbitrage à faire (voir ci-dessus).
- Région Supabase en UE, cookies (seul le cookie d'authentification, nécessaire) à mentionner dans la politique de confidentialité, modération des contenus publiés (bio, avatar).
