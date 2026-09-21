# Base de données

Supabase / PostgreSQL 17 (`supabase/config.toml`), avec PostGIS pour la géolocalisation.

## État

Phase 1 (auth et profils) : 7 migrations écrites dans `supabase/migrations/`, relues par `security-reviewer` et `qa-reviewer`.
**Aucune n'a été exécutée par un agent** : l'environnement est le projet Supabase cloud de développement (`iapbmccyucfcdktmmkkj`),
sans base locale (pas de Docker). L'utilisateur les applique lui-même :

```bash
pnpm exec supabase login
pnpm exec supabase link --project-ref iapbmccyucfcdktmmkkj
pnpm exec supabase db push --dry-run   # vérifie ce qui sera appliqué
pnpm exec supabase db push
```

Avant le premier push : vérifier qu'il n'existe pas déjà de table `profiles` ni de trigger de démarrage sur `auth.users` dans le projet
(les `create table` ne sont pas conditionnels), et qu'aucun utilisateur de test n'existe (un compte créé avant le trigger n'aura pas de profil).

Après le push :

1. Coller `supabase/tests/manual/phase1-rls-checks.sql` dans le SQL Editor : environ 80 vérifications PASS/FAIL (RLS, grants, RPC, Storage), dans une transaction annulée.
   Un FAIL peut venir du script lui-même (voir ses commentaires, la section Storage est la plus fragile) : lire la colonne « détail ».
2. Régénérer les types (voir ci-dessous).
3. Lancer les **Advisors** Security et Performance du Dashboard. Le linter signalera `set_profile_location` et `clear_profile_location`
   (fonctions `security definer` exécutables par `authenticated`) : c'est voulu, elles vérifient `auth.uid()`.

## Règles

- Migrations dans `supabase/migrations/`, une par changement logique.
- UUID en clé primaire, `created_at` / `updated_at` sur chaque table.
- RLS activée sur **chaque** table, grants explicites (on ne dépend pas du réglage « exposer automatiquement les nouvelles tables »).
- Localisation : coordonnées exactes privées, localisation publique approximative séparée.
- Fonctions `security definer` : `set search_path = ''`, noms qualifiés, `execute` révoqué à `public` et `anon`.
- Types TypeScript vers `packages/types/src/database.ts`. En phase 1 le fichier est écrit à la main d'après les migrations
  (des tests de contrat dans `packages/api/src/contract.test.ts` vérifient qu'il dit la même chose que le SQL). Après le push, le régénérer :
  `pnpm exec supabase gen types typescript --project-id iapbmccyucfcdktmmkkj > packages/types/src/database.ts`
- Pas de tests pgTAP tant qu'il n'y a pas de base locale : la RLS est relue à la main et vérifiée par le script manuel ci-dessus.

## Schéma de la phase 1

Migrations, dans l'ordre :

| Fichier                                               | Contenu                                                                            |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `20260920100000_enable_postgis`                       | Extension PostGIS dans le schéma `extensions`                                      |
| `20260920100100_create_private_schema_and_updated_at` | Schéma `private` (fermé aux rôles de l'API) et trigger `private.set_updated_at()`  |
| `20260920100200_create_profiles`                      | Table `profiles`, RLS, privilèges de colonnes                                      |
| `20260920100300_create_profile_private`               | Table `profile_private` (position exacte), RLS                                     |
| `20260920100400_create_signup_trigger`                | `private.handle_new_user()` et trigger sur `auth.users`                            |
| `20260920100500_create_profile_location_rpc`          | RPC `set_profile_location` et `clear_profile_location`                             |
| `20260920100600_create_avatars_bucket`                | Bucket `avatars`, policies `storage.objects`, contrainte sur `profiles.avatar_url` |

### `public.profiles` : profil public

| Colonne        | Type               | Règle                                                                           |
| -------------- | ------------------ | ------------------------------------------------------------------------------- |
| `id`           | `uuid`             | PK, `references auth.users(id) on delete cascade`                               |
| `username`     | `text`             | `not null unique`, `profiles_username_format` : `~ '^[a-z0-9_]{3,30}$'`         |
| `display_name` | `text`             | nullable ; renseigné, entre 1 et 50 caractères. Initialisé avec le pseudo       |
| `bio`          | `text`             | nullable ; renseignée, entre 1 et 500 caractères                                |
| `avatar_url`   | `text`             | nullable ; voir « Avatars »                                                     |
| `city`         | `text`             | nullable ; renseignée, entre 1 et 100 caractères                                |
| `approx_lat`   | `double precision` | nullable, entre -90 et 90 ; arrondi à 2 décimales (environ 1 km) par la RPC     |
| `approx_lng`   | `double precision` | nullable, entre -180 et 180 ; `approx_lat` et `approx_lng` sont nulles ensemble |
| `created_at`   | `timestamptz`      | `not null default now()`                                                        |
| `updated_at`   | `timestamptz`      | `not null default now()`, maintenu par trigger                                  |

Accès :

- `select` : `anon` et `authenticated`, toutes les lignes (`using (true)`). La table ne contient rien de privé.
- Ni `insert` ni `delete` pour les clients : le profil est créé par le trigger d'inscription et supprimé par cascade avec le compte.
- `update` : propriétaire uniquement, et **privilège de colonnes** : `grant update (display_name, bio, avatar_url, city)`.
  Toute autre colonne renvoie `42501 permission denied`. Donc `username` est **immuable** en phase 1 et `approx_*` ne change que par les RPC (l'arrondi est garanti).

### `public.profile_private` : position exacte

`id` (PK, `references profiles(id) on delete cascade`), `exact_lat`, `exact_lng` (`not null`, bornées), `created_at`, `updated_at`.
Lecture : le propriétaire seul (`authenticated`, `(select auth.uid()) = id`). **Aucune** policy ni aucun privilège d'écriture : seules les RPC écrivent ici.
Pas de colonne `geography` ni d'index GiST en phase 1 : rien ne cherche encore par rayon sur les profils.

### RPC

`security definer`, `set search_path = ''`, `execute` réservé à `authenticated`, `auth.uid()` vérifié dans le corps.

- `set_profile_location(p_lat, p_lng) returns void` : refuse un appel anonyme et les coordonnées nulles, `NaN`, infinies ou hors limites ;
  écrit l'exacte dans `profile_private` (upsert) et `round(p_lat::numeric, 2)` / `round(p_lng::numeric, 2)` dans `profiles`.
- `clear_profile_location() returns void` : supprime la ligne de `profile_private` et remet `approx_*` à `null`.

### Inscription

Trigger `on_auth_user_created` (`after insert on auth.users`) : crée le profil avec `username = lower(raw_user_meta_data ->> 'username')`, `display_name` identique.
Cette valeur vient du client : elle est validée dans le trigger (même regex), et le trigger ne s'exécute qu'à l'insertion, donc `updateUser({ data })` n'a aucun effet ensuite.
Pseudo absent, invalide ou déjà pris : exception, l'inscription est annulée. GoTrue remonte alors une erreur générique (« Database error saving new user ») ;
les clients vérifient la disponibilité avant (`isUsernameAvailable`, simple confort) et affichent que le pseudo est probablement pris.

Conséquence : tout utilisateur créé sans `username` est refusé (bouton « Add user » du Dashboard, invitation, Google / Apple, connexion anonyme).
Pour un compte de test au Dashboard, renseigner `{"username": "test_user"}` dans « User Metadata ». Le trigger sera à revoir avant d'ajouter Google ou Apple.

### Avatars

Bucket `avatars` : `public = true`, 2 Mo, `image/jpeg`, `image/png`, `image/webp` (pas de SVG). Un fichier par utilisateur, écrasé à chaque envoi : `avatars/{uid}/avatar`.

Policies `storage.objects` (`authenticated`, bucket `avatars`) : `select`, `insert`, `update`, `delete` uniquement sur l'objet dont le nom est exactement `{uid}/avatar`
(`upsert` demande insert + select + update). Pas de policy `select` pour `anon` : la lecture par URL est assurée par `public = true`, et une policy ouverte permettrait de lister le bucket.

`profiles.avatar_url` est contraint (`profiles_avatar_url_format`) : `null`, ou une URL de 300 caractères maximum de la forme
`http(s)://<hôte>/storage/v1/object/public/avatars/{id}/avatar`, éventuellement suivie de `?v=<chiffres>` (paramètre de cache de `uploadAvatar`).

**Limite connue** : la base ne connaît pas l'URL du projet, le nom d'hôte n'est donc pas vérifié. Un client qui écrit directement dans l'API peut enregistrer une URL externe au bon format.
Les clients appellent donc `isTrustedAvatarUrl` (`@yakila/api`) avant d'afficher un avatar, et le web restreint `images.remotePatterns` dans `next.config.ts`.

## Décisions prises à la relecture (écarts avec le contrat initial)

Plus strict que le contrat de départ, et gardé : policy `select` du bucket réservée au propriétaire ; nom d'objet exact `{uid}/avatar` (et non « dans le dossier `{uid}/` »,
sinon fichiers illimités) ; textes renseignés jamais vides ; `approx_*` nuls ensemble ; `avatar_url` ancré au début et borné à 300 caractères ; fonctions de trigger dans le schéma `private`.
Ajouts au handoff : `clear_profile_location()` (RGPD : pouvoir retirer sa position), `username` immuable.

## Points ouverts (décisions à prendre, pas des bugs)

- **Lecture publique complète des profils** : avec la clé publique, n'importe qui peut lister tous les profils, position approximative (~1 km) comprise.
  Piste recommandée : `grant select` de colonnes à `anon` sans `approx_*` (réservées à `authenticated`), et à terme recherche locale par RPC paginée avec distances par tranches.
  Cela oblige à remplacer `select("*")` par une liste de colonnes dans `packages/api`.
- **Profil créé avant confirmation de l'e-mail** : un compte jamais confirmé réserve son pseudo et a un profil public. Pas de liste de pseudos réservés (`admin`, `support`, `yakila`…).
  Pistes : table `private.reserved_usernames`, purge des comptes non confirmés, CAPTCHA à l'inscription.
- **Trigger qui peut échouer** : selon le comportement de GoTrue (à vérifier sur le projet), l'échec du trigger pourrait permettre de deviner si une adresse e-mail a un compte.
  Piste : un trigger qui n'échoue jamais (pseudo de repli `user_<hex>`) et une RPC à usage unique pour choisir le pseudo (règle aussi Google / Apple).
- **`avatar_url` ou version d'avatar** : ne plus stocker d'URL mais un numéro de version, l'URL étant reconstruite par chaque client depuis son `SUPABASE_URL`.
  Supprime la classe de faille de l'hôte externe et évite des URL de dev dans une base de production. Modifie le contrat : à décider avant la production.
- **`profile_private`** : la position exacte est stockée sans usage avant la phase 3. Une recherche par rayon sur la position exacte permettrait de la retrouver par trilatération
  (l'attaquant choisit le centre) : la recherche doit utiliser la position approximative.
- **Suppression de compte (RGPD)** : absente. À concevoir avec une fonction serveur (service role côté serveur uniquement) qui supprime l'avatar par l'API Storage,
  puis l'utilisateur en suppression définitive (`shouldSoftDelete` désactivé, sinon la cascade ne joue pas et la position exacte reste).

## Réglages du Dashboard Supabase (hors migrations, non versionnés)

`supabase/config.toml` ne s'applique qu'à une base locale : `db push` ne le pousse pas. À régler à la main sur le projet cloud :

1. Authentication, Providers, Email : longueur minimale du mot de passe à **8** (6 par défaut), décider de « Confirm email ».
2. « Allow anonymous sign-ins » désactivé (le trigger refuserait ces connexions).
3. Authentication, URL Configuration : Site URL `http://localhost:3000` en développement ; Redirect URLs `http://localhost:3000/**` et `yakila://**` (schéma de l'app mobile).
4. Authentication, Emails : modèle « Confirm signup » avec le lien `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email` (route web `apps/web/src/app/auth/confirm/route.ts`).
5. SMTP personnalisé si la confirmation d'e-mail est active (le SMTP par défaut est très limité).
6. Data API : schémas exposés = `public` seulement. Ne jamais ajouter `private`. Désactiver `pg_graphql` si le GraphQL n'est pas utilisé.
7. Vérifier que `postgis` est dans le schéma `extensions`, que le projet est en région UE, et que les clés de signature JWT sont asymétriques (sinon `getClaims()` refait un appel réseau à chaque requête).
8. Avant le lancement : CAPTCHA à l'inscription, protection contre les mots de passe compromis.

## Côté clients (`packages/`)

- `@yakila/types` : `Database`, `Profile`, `AVATAR_BUCKET`, `AVATAR_MAX_BYTES`, `AVATAR_MIME_TYPES`.
- `@yakila/validation` : `usernameSchema`, `emailSchema`, `passwordSchema` (72 octets maximum : bcrypt), `signUpSchema`, `signInSchema`, `updateProfileSchema`, `avatarFileSchema`, `coordinatesSchema`,
  et les constantes `USERNAME_PATTERN`, `DISPLAY_NAME_MAX`, `BIO_MAX`, `CITY_MAX`, `PASSWORD_MAX_BYTES` (alignées sur les contraintes SQL).
- `@yakila/api` : `createSupabaseClient(url, anonKey, options?)` (refuse une clé service role), `isServiceRoleKey`, `isTrustedAvatarUrl`, et `fetchProfile`, `fetchProfileByUsername`,
  `isUsernameAvailable`, `updateOwnProfile`, `setProfileLocation`, `clearProfileLocation`, `uploadAvatar`. Ces helpers prennent un `SupabaseClient<Database>` :
  le client de `createSupabaseClient` (mobile) comme ceux de `@supabase/ssr` (web) conviennent.
