# YaKiLa

Marketplace locale pour trouver quelqu'un, proposer ses services et gagner de l'argent autour de soi.
Langue du produit et de la doc : français. Le code et les identifiants sont en anglais.

## Vision

Question guide à chaque décision : **cette fonctionnalité aide-t-elle réellement quelqu'un à trouver un service local ou à gagner de l'argent localement ?** Sinon, priorité basse.

Deux univers, un seul compte, une seule messagerie, une seule réputation :

- **YaKiLa** : services et missions locales ("Ya qui là pour faire ça ?").
- **YaKoiLa** : biens entre particuliers, façon Leboncoin ("Y'a quoi là ?").

Un compte est simultanément client, prestataire, demandeur/exécutant de mission, acheteur et vendeur. Pas de compte "vendeur" séparé : l'activité de prestataire s'active sur le même compte.

Trois entrées produit : _J'ai besoin de quelqu'un_ / _Je veux gagner de l'argent_ / _Je veux acheter ou vendre_.

## Stack (sauf raison majeure justifiée)

- Monorepo **pnpm + Turborepo** : `apps/web`, `apps/mobile`, `packages/{ui,types,validation,api,config,utils}`, `supabase/{migrations,functions,seed}`.
- Web : Next.js, React, TypeScript strict, Tailwind, shadcn/ui. SEO, responsive, accessibilité.
- Mobile : React Native + Expo, TypeScript. Maximum de logique partagée avec le web.
- Backend : Supabase (PostgreSQL, PostGIS, Auth, Storage, Realtime, Edge Functions). Pas de backend Node séparé sans justification forte.
- Validation : Zod, schémas partagés dans `packages/validation`.
- Simplicité > microservices. Pas de Kubernetes, Kafka ou Redis sans besoin réel.

## Décisions structurantes : demander avant

Changement de stack, de base de données, architecture backend majeure, dépendance centrale, modèle d'authentification, stratégie de paiement, décision de sécurité importante. Le reste : prendre l'initiative sans demander fichier par fichier.

Si une demande est techniquement mauvaise, dangereuse ou inutilement complexe, l'expliquer brièvement et proposer mieux plutôt que l'exécuter aveuglément. La décision finale revient à l'utilisateur.

## Règles produit et données

- **Géolocalisation centrale** : PostGIS, index adaptés. Rayons 2 / 5 / 10 / 25 / 50 km. Ne jamais exposer les coordonnées exactes : localisation publique approximative, coordonnées techniques privées, adresse communiquée seulement après accord.
- **Sécurité** : RLS sur chaque table (policies + tests). Jamais de service role key côté client, jamais de secret dans le repo (variables d'environnement). Valider côté serveur.
- **RGPD** : suppression de compte, minimisation des données, consentements, protection de la localisation. Signaler toute fonctionnalité à risque réglementaire.
- **Paiements** : hors plateforme au MVP. Architecture prévue pour Stripe / Stripe Connect plus tard. Aucune donnée bancaire stockée chez nous.
- **Catégories** administrables en base, jamais codées en dur dans le frontend (YaKiLa et YaKoiLa ont chacune les leurs).
- **Avis** : uniquement après une interaction reconnue par le système ; empêcher faux avis, doublons et auto-évaluation.
- **Modération** dès le départ : signalements, blocage, suspension, rôle admin.
- UUID, `created_at` / `updated_at`, index nécessaires, pagination sur toutes les listes.
- i18n non implémentée au MVP, mais ne pas la rendre impossible.

## Conventions de code

- TypeScript strict, éviter `any`, types générés depuis Supabase, fonctions petites, noms clairs.
- Code simple, explicite, testé. Pas d'abstraction prématurée ni d'architecture "enterprise" inutile.
- Avant d'ajouter une dépendance : est-elle nécessaire, maintenue, reconnue ?
- Commits logiques et isolés, un par fonctionnalité identifiable. Avant une grosse refactorisation, expliquer le problème et la solution.
- Tester surtout : logique métier, permissions, RLS, auth, création de service / mission / annonce, offres.

## Définition de « terminé »

Une fonctionnalité n'est terminée que si `lint`, `typecheck`, les tests et le `build` passent, et si les migrations sont vérifiées. Ne jamais présenter comme terminé ce qui ne compile pas.

Commandes (pnpm 12, depuis la racine) :

```
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm format   # Prettier
pnpm exec supabase start   # base locale (Docker)
```

Les packages `packages/*` exportent leur TypeScript source (pas de build) ; voir `docs/architecture.md`.

## Méthode de travail

Procéder par phases, sans construire toute l'application d'un coup. Pour chaque phase : analyser, proposer l'approche, implémenter, lancer les vérifications, corriger, puis résumer (ce qui a été créé, fichiers principaux, commandes, décisions, problèmes, prochaine étape).

L'utilisateur est développeur en reprise : expliquer brièvement ce qui est récent ou a beaucoup changé (quoi, pourquoi, où dans le projet), sans expliquer les bases.

Subagents spécialisés dans `.claude/agents/` : `database-architect`, `security-reviewer`, `frontend-web`, `mobile-developer`, `qa-reviewer`. Les utiliser quand cela apporte un avantage réel. Le reviewer ne doit pas être l'agent qui a écrit le code. Pas d'Agent Teams tant que les tâches ne sont pas réellement indépendantes (coût en tokens).

## Roadmap

0. Fondation : monorepo, Next.js, Expo, TS, Tailwind, shadcn, Supabase, env, lint, format, tests, CI, docs.
1. Auth et profils.
2. Services YaKiLa : catégories, création/modification, images, tarifs, page service, profil prestataire.
3. Recherche locale : PostGIS, rayon, filtres, liste, carte.
4. Missions : création, proximité, candidatures, propositions.
5. Messagerie : conversations, messages, realtime, non-lus.
6. Réputation : prestation terminée, avis, badges simples.
7. YaKoiLa : annonces, photos, catégories, recherche locale, favoris.
8. Notifications : internes, puis push.
9. Admin et modération.
10. Production : monitoring, analytics, déploiement, backups, SEO.

## Périmètre MVP

- Prestataire : compte, profil, ville, publier un service, apparaître dans la recherche locale, recevoir un message, discuter.
- Client : compte, rechercher, filtrer autour de soi, ouvrir un profil, contacter.
- Mission : publier une mission, recevoir une candidature, contacter un prestataire.
- YaKoiLa : publier un objet, être découvert localement, recevoir un message.

Hors MVP (architecture prévue, implémentation plus tard) : réservations par créneaux, offres/devis dans le chat, badges avancés, dashboard de revenus et objectifs, paiements, push et email, i18n.

## Documentation à maintenir

`README.md`, `docs/architecture.md`, `docs/database.md`, `docs/product.md`, `docs/security.md`. Documenter les décisions importantes, pas les fonctions triviales.

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **Yakila** (633 symbols, 1259 relationships, 46 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> Index stale? Run `node .gitnexus/run.cjs analyze` from the project root — it auto-selects an available runner. No `.gitnexus/run.cjs` yet? `npx gitnexus analyze` (npm 11 crash → `npm i -g gitnexus`; #1939).

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows. For regression review, compare against the default branch: `detect_changes({scope: "compare", base_ref: "main"})`.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `query({search_query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `context({name: "symbolName"})`.
- For security review, `explain({target: "fileOrSymbol"})` lists taint findings (source→sink flows; needs `analyze --pdg`).

## Never Do

- NEVER edit a function, class, or method without first running `impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit changes without running `detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/Yakila/context` | Codebase overview, check index freshness |
| `gitnexus://repo/Yakila/clusters` | All functional areas |
| `gitnexus://repo/Yakila/processes` | All execution flows |
| `gitnexus://repo/Yakila/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
