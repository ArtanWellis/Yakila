-- Position EXACTE de l'utilisateur : table séparée pour que la RLS la protège réellement.
-- (Une colonne masquée dans `profiles` resterait lisible par tout le monde : la RLS est par ligne, pas par colonne.)
--
-- Lecture : le propriétaire seul. Écriture : aucune policy et aucun privilège pour les clients ;
-- seules set_profile_location() et clear_profile_location() (security definer) écrivent ici.
--
-- Pas de colonne `geography` ni d'index GiST : rien ne cherche encore par rayon sur les profils. Les recherches par
-- rayon utiliseront `profiles.approx_*` (publique) ou une colonne dédiée ajoutée avec la fonctionnalité qui en a besoin.

create table public.profile_private (
  id uuid not null,
  exact_lat double precision not null,
  exact_lng double precision not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profile_private_pkey primary key (id),
  constraint profile_private_id_fkey foreign key (id) references public.profiles (id) on delete cascade,
  constraint profile_private_exact_lat_range check (exact_lat between -90 and 90),
  constraint profile_private_exact_lng_range check (exact_lng between -180 and 180)
);

comment on table public.profile_private is
  'Position exacte de l''utilisateur (privée : lisible par son propriétaire seul, écrite uniquement par les RPC).';

create trigger profile_private_set_updated_at
  before update on public.profile_private
  for each row execute function private.set_updated_at();

alter table public.profile_private enable row level security;

revoke all on table public.profile_private from public, anon, authenticated;

-- Lecture seule pour un utilisateur connecté ; la policy limite à sa propre ligne. `anon` n'a aucun accès.
grant select on table public.profile_private to authenticated;

create policy profile_private_select_own
  on public.profile_private
  for select
  to authenticated
  using ((select auth.uid()) = id);

-- Aucune policy insert / update / delete, et aucun privilège correspondant.

-- Annulation manuelle (supprime les positions exactes) :
--   drop table public.profile_private;
