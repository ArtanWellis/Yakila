# Sécurité

## Règles

- RLS sur chaque table, policies testées. Aucun accès aux données privées d'autrui en modifiant une requête frontend.
- Jamais de service role key côté client ; jamais de secret dans le repo. `.gitignore` exclut `.env*` sauf `.env.example`.
- Variables préfixées `NEXT_PUBLIC_` / `EXPO_PUBLIC_` = publiques (embarquées dans le bundle). Seule la clé anon y a sa place.
- `packages/api` n'accepte que l'URL et la clé anon.
- Coordonnées exactes jamais exposées publiquement.
- Validation côté serveur (schémas Zod de `packages/validation`).

## RGPD

À traiter dès la phase 1 : suppression de compte, minimisation, consentements, politique de confidentialité, protection de la localisation.
