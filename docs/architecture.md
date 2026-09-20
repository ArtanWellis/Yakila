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
- **Tests** : Vitest dans les packages. Web et mobile n'ont pas encore de tests (rien de testable à ce stade).
- **Apps générées par les outils officiels** : `apps/web/AGENTS.md` et `apps/mobile/AGENTS.md` (+ `CLAUDE.md`) viennent de `create-next-app` / `create-expo-app` et rappellent de lire les docs versionnées, ces versions étant récentes.

## Ajouter un package

1. `packages/<nom>/` avec `package.json` (`@yakila/<nom>`, `exports` vers `src/index.ts`), `tsconfig.json` étendant `@yakila/config/tsconfig.base.json`.
2. Ajouter le nom à `transpilePackages` si le web l'importe.
3. `pnpm add @yakila/<nom>@workspace:* --filter web` (ou `mobile`).
