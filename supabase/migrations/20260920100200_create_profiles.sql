-- Profil public : lisible par tout le monde, modifiable uniquement par son propriétaire (et seulement quelques colonnes).
-- La ligne est créée par le trigger d'inscription (migration suivante), jamais par un client.
-- Contrat : docs/database.md, section « Contrat de la phase 1 ».

create table public.profiles (
  id uuid not null,
  username text not null,
  display_name text,
  bio text,
  avatar_url text,
  city text,
  approx_lat double precision,
  approx_lng double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profiles_pkey primary key (id),
  -- Supprimer le compte (auth.users) supprime le profil, puis sa position privée (cascade).
  constraint profiles_id_fkey foreign key (id) references auth.users (id) on delete cascade,
  -- Le `unique` crée l'index utilisé pour la recherche par pseudo : pas d'index supplémentaire.
  constraint profiles_username_key unique (username),
  -- Identique à USERNAME_PATTERN dans packages/validation. Minuscules uniquement : l'unicité est donc insensible à la casse.
  constraint profiles_username_format check (username ~ '^[a-z0-9_]{3,30}$'),
  -- Un texte renseigné n'est jamais vide (les clients envoient null à la place d'une chaîne vide).
  constraint profiles_display_name_length check (char_length(display_name) between 1 and 50),
  constraint profiles_bio_length check (char_length(bio) between 1 and 500),
  constraint profiles_city_length check (char_length(city) between 1 and 100),
  -- Position PUBLIQUE, arrondie à 2 décimales (environ 1 km) : uniquement écrite par set_profile_location().
  constraint profiles_approx_lat_range check (approx_lat between -90 and 90),
  constraint profiles_approx_lng_range check (approx_lng between -180 and 180),
  -- Jamais une moitié de position.
  constraint profiles_approx_position_pair check ((approx_lat is null) = (approx_lng is null))
);

comment on table public.profiles is
  'Profil public (1 ligne par compte). Aucune donnée privée : la position exacte est dans public.profile_private.';
comment on column public.profiles.avatar_url is
  'URL publique de l''avatar de l''utilisateur (bucket avatars). Contrainte ajoutée avec le bucket.';
comment on column public.profiles.approx_lat is
  'Latitude publique arrondie à 2 décimales. Écrite uniquement par set_profile_location / clear_profile_location.';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

-- Sécurité : privilèges (qui peut toucher à la table) PUIS RLS (quelles lignes).
-- Les grants sont explicites : on ne dépend pas du réglage « exposer automatiquement les nouvelles tables ».
alter table public.profiles enable row level security;

-- On part de zéro, y compris pour insert / delete / truncate / references / trigger que les privilèges par défaut
-- de Supabase accordent aux rôles de l'API sur les nouvelles tables de `public`.
revoke all on table public.profiles from public, anon, authenticated;

grant select on table public.profiles to anon, authenticated;

-- Privilège de COLONNES : `username` est immuable, `approx_*` ne changent que par les RPC (garantit l'arrondi),
-- `id` / `created_at` / `updated_at` ne sont pas modifiables par le client.
-- Le client reçoit « permission denied for table profiles » (42501) s'il tente d'autres colonnes.
grant update (display_name, bio, avatar_url, city) on table public.profiles to authenticated;

-- Lecture : tout le monde, la table ne contient rien de privé.
create policy profiles_select_public
  on public.profiles
  for select
  to anon, authenticated
  using (true);

-- Modification : propriétaire seulement. `with check` empêche de réattribuer la ligne à quelqu'un d'autre.
-- `(select auth.uid())` : évalué une seule fois par requête (et non une fois par ligne).
create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Pas de policy insert / delete : ni les privilèges ni la RLS ne les autorisent pour les clients.

-- Annulation manuelle (supprime aussi les données) :
--   drop table public.profiles;   -- après public.profile_private
