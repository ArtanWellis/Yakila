# Base de données

Supabase / PostgreSQL 17 (`supabase/config.toml`), avec PostGIS pour la géolocalisation.

## État

Phase 1 : contrat ci-dessous, migrations à écrire dans `supabase/migrations/`.
Environnement : projet Supabase **cloud** de développement (`iapbmccyucfcdktmmkkj`), pas de base locale.
Les migrations sont écrites dans le repo puis poussées à la main par l'utilisateur :

```
pnpm exec supabase login
pnpm exec supabase link --project-ref iapbmccyucfcdktmmkkj
pnpm exec supabase db push
```

Conséquences : pas de tests pgTAP pour l'instant (pas de base locale), les policies sont relues à la main par `security-reviewer`.

## Règles

- Migrations dans `supabase/migrations/`, une par changement logique.
- UUID en clé primaire, `created_at` / `updated_at` sur chaque table.
- RLS activée sur **chaque** table.
- Localisation : coordonnées exactes privées, localisation publique approximative séparée.
- Types TypeScript vers `packages/types/src/database.ts`. Pour la phase 1 le fichier est écrit à la main d'après le contrat ci-dessous ;
  après le push des migrations, le régénérer :
  `pnpm exec supabase gen types typescript --project-id iapbmccyucfcdktmmkkj > packages/types/src/database.ts`

## Contrat de la phase 1 (auth et profils)

Source de vérité partagée par la base, le web et le mobile. Toute divergence se règle ici d'abord.
Les migrations doivent produire exactement ces noms ; `packages/types/src/database.ts` en est le miroir TypeScript.

### `public.profiles` : profil public

| Colonne        | Type               | Règle                                                                              |
| -------------- | ------------------ | ---------------------------------------------------------------------------------- |
| `id`           | `uuid`             | PK, `references auth.users(id) on delete cascade`                                  |
| `username`     | `text`             | `not null unique`, contrainte `profiles_username_format` : `~ '^[a-z0-9_]{3,30}$'` |
| `display_name` | `text`             | nullable, 50 max. Initialisé avec le pseudo à l'inscription                        |
| `bio`          | `text`             | nullable, 500 max                                                                  |
| `avatar_url`   | `text`             | nullable, uniquement l'URL du propre avatar de l'utilisateur (voir « Avatars »)    |
| `city`         | `text`             | nullable, 100 max                                                                  |
| `approx_lat`   | `double precision` | nullable, arrondi à 2 décimales (environ 1 km), entre -90 et 90                    |
| `approx_lng`   | `double precision` | nullable, arrondi à 2 décimales, entre -180 et 180                                 |
| `created_at`   | `timestamptz`      | `not null default now()`                                                           |
| `updated_at`   | `timestamptz`      | `not null default now()`, maintenu par trigger                                     |

Accès :

- `select` : tout le monde (`anon` et `authenticated`). La table ne contient rien de privé.
- Pas de policy `insert` ni `delete` pour les clients : le profil est créé par le trigger d'inscription et supprimé par cascade.
- `update` : propriétaire uniquement (`(select auth.uid()) = id`), avec des **privilèges de colonnes** :
  `revoke update on public.profiles from anon, authenticated;` puis `grant update (display_name, bio, avatar_url, city) on public.profiles to authenticated;`.
  `username` est **immuable** en phase 1. `approx_lat` / `approx_lng` ne changent que par les RPC ci-dessous, ce qui garantit l'arrondi.

### `public.profile_private` : position exacte

| Colonne      | Type               | Règle                                                  |
| ------------ | ------------------ | ------------------------------------------------------ |
| `id`         | `uuid`             | PK, `references public.profiles(id) on delete cascade` |
| `exact_lat`  | `double precision` | `not null`, entre -90 et 90                            |
| `exact_lng`  | `double precision` | `not null`, entre -180 et 180                          |
| `created_at` | `timestamptz`      | `not null default now()`                               |
| `updated_at` | `timestamptz`      | `not null default now()`, maintenu par trigger         |

Accès : `select` pour le propriétaire seul. **Aucune** policy d'écriture : seules les RPC écrivent ici.
Pas de colonne `geography` en phase 1 (rien ne cherche encore par rayon sur les profils) ; l'extension PostGIS est activée pour les phases suivantes.

### Fonctions RPC (`security definer`, `set search_path = ''`, `execute` réservé à `authenticated`)

- `set_profile_location(p_lat double precision, p_lng double precision) returns void` :
  utilise `auth.uid()`, refuse un utilisateur non connecté et des coordonnées hors limites,
  fait un upsert de l'exact dans `profile_private` et écrit `round(p_lat::numeric, 2)` / `round(p_lng::numeric, 2)` dans `profiles.approx_lat` / `approx_lng`.
- `clear_profile_location() returns void` : supprime la ligne de `profile_private` et remet `approx_lat` / `approx_lng` à `null`.

### Inscription

Trigger `after insert on auth.users` (fonction `security definer`, `set search_path = ''`) : crée la ligne `profiles` avec
`username = raw_user_meta_data ->> 'username'`. La valeur vient du client, donc **elle est validée** dans le trigger (même regex, en minuscules) :
si elle est absente ou invalide, ou déjà prise, l'inscription échoue (exception). Côté client : `supabase.auth.signUp({ email, password, options: { data: { username } } })`.

GoTrue remonte alors une erreur générique (« Database error saving new user »). Les clients vérifient donc la disponibilité du pseudo avant
(`isUsernameAvailable`, simple confort) et affichent un message clair si `signUp` échoue quand même.

### Avatars (Storage)

Bucket `avatars` : `public = true`, `file_size_limit = 2097152` (2 Mo), `allowed_mime_types = {image/jpeg, image/png, image/webp}` (pas de SVG).
Un seul fichier par utilisateur, écrasé à chaque envoi : `avatars/{uid}/avatar`.

Policies sur `storage.objects` pour ce bucket : `select` public ; `insert`, `update` et `delete` réservés à `authenticated` quand
`(storage.foldername(name))[1] = (select auth.uid())::text`. Il faut `insert` **et** `update` car l'envoi se fait avec `upsert: true`.

`profiles.avatar_url` est contraint (`check`) : `null`, ou une URL se terminant par `/storage/v1/object/public/avatars/{id}/avatar`, éventuellement suivie de `?v=<chiffres>`
(paramètre de cache ajouté par `uploadAvatar`). Sans cela, un utilisateur pourrait faire charger à ses visiteurs n'importe quelle image externe.

### Autres exigences

- `updated_at` mis à jour par un trigger `before update` sur chaque table.
- RLS activée sur chaque table, y compris `profile_private`. Politiques écrites avec `(select auth.uid())` (évalué une fois par requête).
- `username` : l'unicité est déjà indexée par la contrainte `unique`.

### Hors périmètre de la phase 1 (à traiter ensuite)

Suppression de compte (RGPD : nécessite de retirer l'avatar du Storage, à concevoir), réinitialisation de mot de passe, connexion Google / Apple,
liste de pseudos réservés (`admin`, `support`, …), consentement CGU / politique de confidentialité, rôle admin.

## Côté clients (`packages/`)

- `@yakila/types` : `Database`, `Profile`, constantes `AVATAR_BUCKET`, `AVATAR_MAX_BYTES`, `AVATAR_MIME_TYPES`.
- `@yakila/validation` : `usernameSchema`, `emailSchema`, `passwordSchema`, `signUpSchema`, `signInSchema`, `updateProfileSchema`, `avatarFileSchema`, `coordinatesSchema`.
- `@yakila/api` : `createSupabaseClient(url, anonKey, options?)` (refuse une clé service role), et `fetchProfile`, `fetchProfileByUsername`, `isUsernameAvailable`,
  `updateOwnProfile`, `setProfileLocation`, `clearProfileLocation`, `uploadAvatar`. Ces helpers prennent un `SupabaseClient<Database>` :
  le client de `createSupabaseClient` (mobile) comme ceux de `@supabase/ssr` (web) conviennent.
