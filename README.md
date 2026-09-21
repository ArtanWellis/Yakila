# YaKiLa

La marketplace locale pour trouver quelqu'un, proposer ses services et gagner de l'argent autour de soi.

- **YaKiLa** : services et missions locales.
- **YaKoiLa** : biens entre particuliers.

Vision, règles et conventions : [CLAUDE.md](CLAUDE.md). Détails dans [docs/](docs/).

## Prérequis

- Node.js 22+ (testé avec 24)
- pnpm 12 (`npm i -g pnpm`)
- Un projet Supabase (développement : projet cloud). Docker est facultatif, seulement pour une future base locale.

## Démarrage

```bash
pnpm install
cp .env.example apps/web/.env.local   # puis renseigner l'URL et la clé publishable (Dashboard Supabase)
cp .env.example apps/mobile/.env      # même chose, variables EXPO_PUBLIC_*
pnpm dev                              # web (http://localhost:3000) + mobile (Expo)
```

Les migrations sont dans `supabase/migrations/` et se poussent à la main vers le projet cloud
(`pnpm exec supabase login`, `link`, `db push`) : voir [docs/database.md](docs/database.md), qui liste aussi les réglages à faire dans le Dashboard.

## Commandes

| Commande         | Effet                                     |
| ---------------- | ----------------------------------------- |
| `pnpm dev`       | Lance web et mobile en mode développement |
| `pnpm lint`      | ESLint sur tous les workspaces            |
| `pnpm typecheck` | TypeScript strict sur tous les workspaces |
| `pnpm test`      | Tests (Vitest) sur les packages           |
| `pnpm build`     | Build de production                       |
| `pnpm format`    | Formate avec Prettier                     |

Base locale (optionnelle, nécessite Docker) : `pnpm exec supabase start`, puis `pnpm exec supabase status` pour les clés.

## Structure

```
apps/web         Next.js (App Router, Tailwind)
apps/mobile      Expo / React Native
packages/config  tsconfig partagé
packages/types   types et constantes du domaine
packages/validation  schémas Zod
packages/utils   helpers
packages/api     client Supabase
supabase/        config, migrations, seed, edge functions
docs/            architecture, base de données, produit, sécurité
```
