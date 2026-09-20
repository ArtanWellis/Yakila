-- Schéma `private` et trigger générique `updated_at`.
--
-- `private` n'est PAS dans la liste des schémas exposés par l'API Data (PostgREST) : rien de ce qu'il contient n'est
-- appelable depuis un client. On y range les fonctions internes (triggers), en particulier les `security definer`,
-- qui sinon deviendraient des endpoints `/rpc/...` publics (les fonctions du schéma `public` sont exécutables par
-- tous les rôles par défaut).
--
-- Un trigger n'exige pas que l'utilisateur qui déclenche l'écriture ait `execute` sur la fonction de trigger :
-- le droit n'est vérifié qu'à la création du trigger. On peut donc tout révoquer sans casser les mises à jour.

create schema if not exists private;

-- Défense en profondeur : aucun rôle de l'API n'a accès au schéma, même si les privilèges par défaut changent.
revoke all on schema private from public, anon, authenticated;

-- Met à jour `updated_at` à chaque `update`. Volontairement `security invoker` : elle ne touche qu'à la ligne en cours.
-- `search_path` vide : `now()` vit dans pg_catalog, toujours résolu.
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.set_updated_at() from public, anon, authenticated;

-- Annulation manuelle (après avoir supprimé les triggers qui l'utilisent) :
--   drop function if exists private.set_updated_at();
--   drop schema if exists private;
