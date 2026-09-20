# Base de données

Supabase / PostgreSQL 17 (`supabase/config.toml`), avec PostGIS pour la géolocalisation.

## État

Phase 0 : aucune migration. Le premier schéma (extensions PostGIS, `profiles`, RLS) arrive en phase 1, écrit et testé avec la base locale (`pnpm exec supabase start`).

## Règles

- Migrations dans `supabase/migrations/`, une par changement logique.
- UUID en clé primaire, `created_at` / `updated_at` sur chaque table.
- RLS activée sur **chaque** table, avec tests.
- Localisation : coordonnées exactes privées, localisation publique approximative séparée.
- Types TypeScript générés vers `packages/types/src/database.ts` :
  `pnpm exec supabase gen types typescript --local > packages/types/src/database.ts`
