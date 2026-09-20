# Passation : démarrer la phase 1 avec les agents

Document de reprise pour une nouvelle session Claude Code ouverte dans `C:\Users\elias\Documents\Yakila`.
Lis aussi `CLAUDE.md` (vision, règles) et `docs/architecture.md`.

## État du projet

- Phase 0 terminée : monorepo pnpm 12 + Turborepo, `apps/web` (Next.js 16, Tailwind 4), `apps/mobile` (Expo 57), `packages/{config,types,validation,utils,api}`.
  `pnpm format:check`, `lint`, `typecheck`, `test` et `build` passaient à la fin de la phase 0.
- Historique git : `Initial commit`, `first agentic archi`, `gitnexus setup`, `add skills supabase`. Vérifier `git status` avant de commencer.
- `supabase/` : `config.toml` (config locale par défaut) et dossiers `migrations/`, `functions/`, `seed/` **vides**. Aucune migration écrite.
- GitNexus : repo indexé (`node .gitnexus/run.cjs analyze`, ajouter `--force` si l'index est incohérent). Le bloc GitNexus de `CLAUDE.md` impose `impact` avant de modifier un symbole et `detect_changes` avant un commit.
  Limite connue : les imports entre packages du workspace (`@yakila/*`) ne sont pas résolus par l'index. Vérifier les usages avec Grep en plus.
- Skills Supabase installées dans `.claude/skills/supabase*` : à utiliser pour les migrations et la RLS.

## Supabase : cloud uniquement, pas de Docker

Décision : **on utilise le projet Supabase cloud**, pas `supabase start`. Ce projet est l'environnement de **développement** ; un second projet servira de production avant le lancement.

- Projet : `iapbmccyucfcdktmmkkj` (`https://iapbmccyucfcdktmmkkj.supabase.co`).
- `.env` à la racine contient `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY` (clé `sb_publishable_…`, publique par conception). Ce fichier est ignoré par git.
- **À faire** : Next lit `apps/web/.env.local` et Expo lit `apps/mobile/.env`, pas le `.env` racine. Copier l'URL et la clé anon dans ces deux fichiers (`EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` côté mobile, qui pointe encore vers `127.0.0.1:54321` sans clé).
- Jamais de clé `service_role` / `sb_secret_…` dans un fichier `NEXT_PUBLIC_` ou `EXPO_PUBLIC_`, ni dans git.
- **Les agents ne poussent pas les migrations.** Ils écrivent les fichiers dans `supabase/migrations/`. L'utilisateur les applique lui-même (identifiants requis) :

```bash
pnpm exec supabase login
pnpm exec supabase link --project-ref iapbmccyucfcdktmmkkj
pnpm exec supabase db push
```

- Conséquence : pas de tests RLS automatisés (pgTAP) pour l'instant, faute de base locale. `security-reviewer` relit les policies à la main. pgTAP viendra avec Docker plus tard.

## Phase 1 : périmètre

Auth et profils, sur web et mobile.

Choix déjà validés :

- Connexion **email + mot de passe** d'abord. Google et Apple plus tard (Apple exige un compte développeur payant sur iOS).
- **Pseudo unique** (`username`) obligatoire à l'inscription.
- Localisation : ville + position **approximative publique** (arrondie à 2 décimales, environ 1 km). Coordonnées exactes privées, visibles du seul propriétaire.
- Mot de passe : 8 caractères minimum.

## Contrat à écrire avant de lancer les agents en parallèle

Le lead (session principale) écrit ce contrat en premier, sinon web, mobile et base devinent des schémas différents.

**Base de données** (`supabase/migrations/`) :

- Extension PostGIS.
- `public.profiles` : `id uuid` (clé primaire, référence `auth.users` en `on delete cascade`), `username text unique not null` (`^[a-z0-9_]{3,30}$`), `display_name`, `bio` (500 max), `avatar_url`, `city`, `approx_lat`, `approx_lng` (arrondis), `created_at`, `updated_at`.
  Lecture publique, modification par le seul propriétaire.
- `public.profile_private` : `id`, coordonnées exactes. **Table séparée** pour que la RLS protège réellement les coordonnées. Accès propriétaire uniquement.
- Fonction RPC `set_profile_location(p_lat, p_lng)` : écrit l'exact dans `profile_private` et l'arrondi dans `profiles`.
- Trigger de création du profil à l'inscription, à partir de `raw_user_meta_data.username`.
- Bucket Storage `avatars` : lecture publique, écriture dans le dossier `{uid}/` du propriétaire, 2 Mo max, images uniquement.
- `updated_at` maintenu par trigger, RLS activée sur chaque table.
- Types générés vers `packages/types/src/database.ts`.

**Packages partagés** (le lead les écrit, les agents ne les modifient pas) :

- `packages/validation` : `usernameSchema`, `signUpSchema`, `signInSchema`, `updateProfileSchema` (avec tests Vitest).
- `packages/types` : type `Profile` aligné sur la table.
- `packages/api` : `createSupabaseClient(url, anonKey, options?)` pour accepter le stockage sécurisé du mobile.

**Dépendances** : les installer **avant** de lancer les agents, car plusieurs `pnpm add` simultanés se disputent `pnpm-lock.yaml`. Les agents ne lancent ni `pnpm add` ni `pnpm install` ; ils listent les dépendances manquantes dans leur rapport.

- Web : `@supabase/ssr`.
- Mobile (via `pnpm exec expo install` pour les bonnes versions) : `expo-router`, `expo-secure-store`, `expo-image-picker`, `react-native-url-polyfill`, `react-native-safe-area-context`, `react-native-screens`, `expo-linking`, `expo-constants`.

## Plan d'exécution

Les agents personnalisés de `.claude/agents/` ne se chargent qu'au démarrage : dans une nouvelle session ils doivent être disponibles directement (`database-architect`, `security-reviewer`, `frontend-web`, `mobile-developer`, `qa-reviewer`). Sinon, utiliser un agent générique avec leur contenu comme instructions.

1. **Lead** : contrat + dépendances (ci-dessus), fichiers `.env` copiés, commit propre.
2. **Vague 1, en parallèle**, chacun dans son périmètre de fichiers :
   - `database-architect` : `supabase/` uniquement (migrations, types générés impossibles sans base locale : écrire `database.ts` à la main ou laisser le lead le générer après le push).
   - `frontend-web` : `apps/web/` (inscription, connexion, déconnexion, page profil, édition, avatar, position approximative).
   - `mobile-developer` : `apps/mobile/` (mêmes écrans, expo-router, session dans `expo-secure-store`).
3. **Vague 2, en parallèle**, une fois le code écrit :
   - `security-reviewer` : relecture des migrations et policies, exposition des coordonnées, secrets, uploads.
   - `qa-reviewer` : `pnpm format:check`, `lint`, `typecheck`, `test`, `build`, cas limites, tests manquants.
4. **Lead** : corrige, relance les vérifications, `node .gitnexus/run.cjs analyze`, puis l'utilisateur pousse les migrations et commite.

Les deux vagues sont nécessaires : `security-reviewer` et `qa-reviewer` relisent du code qui n'existe pas avant la vague 1.

## Règles à rappeler aux agents

- Une seule écriture par fichier : chaque agent reste dans son dossier.
- Pas de `pnpm add` / `install`, pas de commit, pas de push de migration.
- Terminé = `lint`, `typecheck`, `test` et `build` passent. Ne jamais annoncer terminé ce qui ne compile pas.
- Expliquer brièvement les technologies récentes utilisées (l'utilisateur est développeur en reprise).
- Les rapports d'agents contiennent : fichiers modifiés, décisions, risques, ce qui n'a pas pu être testé.

## Points d'attention connus

- pnpm 12 est installé globalement via `npm i -g pnpm` (`corepack enable` échoue avec EPERM sur cette machine).
- `pnpm peers check` signale des avertissements côté Expo (eslint, react-dom). Lint et bundle passent quand même.
- TypeScript : ~6.0 pour Expo, 5.x pour Next, la dernière pour les packages. Voulu et documenté dans `docs/architecture.md`.
- `apps/web/AGENTS.md` et `apps/mobile/AGENTS.md` demandent de lire la doc versionnée de Next 16 et Expo 57 avant d'écrire du code.
- Ces deux fichiers, `CLAUDE.md` et `AGENTS.md` racine, sont exclus de Prettier (`.prettierignore`) car GitNexus régénère leur contenu.
- `shadcn/ui` n'est pas encore initialisé. Décider avec l'agent web s'il est utile en phase 1 ; sinon composants Tailwind simples.

## Prompt à coller pour démarrer la nouvelle session

> Lis `CLAUDE.md` et `docs/handoff-phase1.md`. Fais l'étape 1 du plan (contrat, dépendances, `.env`), puis lance la vague 1 avec les subagents `database-architect`, `frontend-web` et `mobile-developer` en parallèle, puis la vague 2 avec `security-reviewer` et `qa-reviewer` en parallèle. Supabase est en cloud : ne cherche pas à lancer Docker, et ne pousse aucune migration, je le ferai moi-même. Résume-moi à chaque étape.
