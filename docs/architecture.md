# Architecture

## Vue d'ensemble

Monorepo pnpm + Turborepo. Web (Next.js) et mobile (Expo) partagent la logique via `packages/`.
Le backend est entièrement Supabase (PostgreSQL + PostGIS, Auth, Storage, Realtime, Edge Functions) : pas de serveur Node séparé.

## Décisions de la phase 0

- **Packages internes sans étape de build** : `packages/*` exportent directement leur TypeScript (`"exports": { ".": "./src/index.ts" }`).
  Next les compile via `transpilePackages` (`apps/web/next.config.ts`), Metro (Expo) les lit tels quels. Pas de `dist/` à maintenir.
- **`packages/ui` non créé** : shadcn/ui est web-only et le mobile n'a pas de composants partagés pour l'instant.
  On l'ajoutera quand un composant sera réellement partagé, pas avant.
- **TypeScript** : `packages/config/tsconfig.base.json` (strict + `noUncheckedIndexedAccess`) pour les packages. Web et mobile gardent leur `tsconfig` généré (Next / Expo).
  Les versions de TypeScript diffèrent volontairement : Expo impose la sienne (~6.0), Next 5.x, les packages utilisent la dernière.
- **`typecheck` web** : lance `next typegen` avant `tsc` (génère les types globaux comme `LayoutProps`).
- **Tests** : Vitest dans les packages. Web et mobile n'ont pas de lanceur de tests (voir « Décisions de la phase 1 »).
- **Apps générées par les outils officiels** : `apps/web/AGENTS.md` et `apps/mobile/AGENTS.md` (+ `CLAUDE.md`) viennent de `create-next-app` / `create-expo-app` et rappellent de lire les docs versionnées, ces versions étant récentes.

## Décisions de la phase 1 (auth et profils)

Le schéma, la RLS et le contrat des packages sont décrits dans [database.md](database.md), les mesures de sécurité dans [security.md](security.md).

- **Logique partagée** dans `packages/` : types (`Database`, `Profile`), schémas Zod (pseudo, e-mail, mot de passe, profil, avatar) et helpers d'accès aux profils prenant un `SupabaseClient<Database>`
  (le client de `@supabase/ssr` côté web et celui de `createSupabaseClient` côté mobile sont acceptés). Les règles sensibles y vivent une seule fois : `isTrustedAvatarUrl`, `isServiceRoleKey`, `passwordSchema`.
- **Web** (Next 16) :
  - `src/proxy.ts` (nouveau nom de `middleware.ts`) rafraîchit la session avec `getClaims()` ; clients Supabase dans `src/lib/supabase/` (`client`, `server`, `proxy`, `public`, `env`).
  - Server actions dans `src/lib/auth/` et `src/lib/profile/`, qui re-valident avec Zod.
  - Routes : `/inscription`, `/connexion`, `/auth/confirm` (lien de l'e-mail de confirmation), `/profil` (protégée, `noindex`), `/u/[username]` (publique, indexable, vrai 404 si le pseudo n'existe pas).
  - Toutes les routes sont rendues à la demande car l'en-tête lit les cookies. Le profil public utilise déjà un client anonyme sans cookies, prêt pour un futur cache.
  - Sans variables Supabase, le build passe (la CI n'en a pas) mais toutes les routes répondent 500 à l'exécution : un artefact construit en CI ne doit pas être déployé, les `NEXT_PUBLIC_*` étant figées à la compilation.
- **Mobile** (Expo 57) : expo-router avec les routes dans `src/app` (groupes `(auth)` et `(tabs)`, `Stack.Protected` pour la redirection connecté / non connecté), session dans `src/session/`,
  client Supabase dans `src/lib/supabase.ts`. Le stockage de session est un adaptateur `expo-secure-store` qui découpe les valeurs en morceaux (`src/lib/chunked-storage.ts`), car une session dépasse la limite de taille d'une valeur.
- **Variables d'environnement** : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL` (web) ; `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` (mobile). Voir `.env.example`.
- **Tests** : les packages en ont (validation, api), dont des tests de contrat (`packages/api/src/contract.test.ts`) qui lisent les migrations SQL et vérifient qu'elles disent la même chose que les types et les schémas Zod.
  **Web et mobile n'ont aucun lanceur de tests** : la logique pure y est isolée en petites fonctions (`safeNextPath`, `chunked-storage`, `auth-errors`, `isTrustedAvatarUrl`, `fitWithin`…) pour pouvoir en ajouter (Vitest est déjà utilisé dans les packages). C'est une dette de test à traiter.
- **shadcn/ui** non initialisé : composants Tailwind simples en phase 1 (les agents ne pouvaient pas ajouter de dépendances). À décider avec les premiers écrans de liste.
- **GitNexus** : l'index ne résout pas les imports entre packages du workspace (`@yakila/*`), et `impact` sous-estime donc les fonctions de `packages/`. Vérifier aussi avec Grep.

## Ajouter un package

1. `packages/<nom>/` avec `package.json` (`@yakila/<nom>`, `exports` vers `src/index.ts`), `tsconfig.json` étendant `@yakila/config/tsconfig.base.json`.
2. Ajouter le nom à `transpilePackages` si le web l'importe.
3. `pnpm add @yakila/<nom>@workspace:* --filter web` (ou `mobile`).
