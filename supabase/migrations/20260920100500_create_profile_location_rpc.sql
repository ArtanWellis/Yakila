-- RPC de localisation : seule voie d'écriture de la position (exacte privée + approximative publique).
--
-- Pourquoi des fonctions plutôt que des `update` directs : l'arrondi public est calculé côté base, le client ne peut donc
-- pas publier une position plus précise que prévu, ni écrire dans profile_private (aucune policy d'écriture).
--
-- Ce sont des fonctions `security definer` DANS le schéma `public` (obligatoire pour être appelées via supabase.rpc) :
-- Postgres accorde `execute` à PUBLIC par défaut et Supabase l'accorde aussi à anon / authenticated. On révoque donc
-- explicitement, puis on n'accorde qu'à `authenticated`. Deuxième barrière dans le corps : `auth.uid()` doit être renseigné.
-- `search_path` vide : tous les noms sont qualifiés.
--
-- Appel côté client : supabase.rpc('set_profile_location', { p_lat, p_lng }) et supabase.rpc('clear_profile_location').

create or replace function public.set_profile_location(p_lat double precision, p_lng double precision)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  -- `not between` est faux pour NaN et l'infini, d'où ce test plutôt que `<` / `>`. null est traité à part.
  if p_lat is null or p_lng is null
     or p_lat not between -90 and 90
     or p_lng not between -180 and 180 then
    raise exception 'invalid_coordinates' using errcode = '22023';
  end if;

  -- Position exacte : privée. `updated_at` est mis à jour par le trigger en cas de conflit.
  insert into public.profile_private (id, exact_lat, exact_lng)
  values (v_uid, p_lat, p_lng)
  on conflict (id) do update
    set exact_lat = excluded.exact_lat,
        exact_lng = excluded.exact_lng;

  -- Position publique : 2 décimales (environ 1 km). L'arrondi passe par numeric pour éviter les artefacts des flottants.
  update public.profiles
     set approx_lat = round(p_lat::numeric, 2),
         approx_lng = round(p_lng::numeric, 2)
   where id = v_uid;
end;
$$;

create or replace function public.clear_profile_location()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  delete from public.profile_private where id = v_uid;

  update public.profiles
     set approx_lat = null,
         approx_lng = null
   where id = v_uid;
end;
$$;

comment on function public.set_profile_location(double precision, double precision) is
  'Enregistre la position exacte (privée) et sa version arrondie à 2 décimales (publique) de l''utilisateur connecté.';
comment on function public.clear_profile_location() is
  'Efface la position exacte et la position publique de l''utilisateur connecté.';

-- `anon` ne doit rien pouvoir appeler : les révocations couvrent PUBLIC et le grant direct d'`anon` des privilèges par défaut.
revoke all on function public.set_profile_location(double precision, double precision) from public, anon;
revoke all on function public.clear_profile_location() from public, anon;

grant execute on function public.set_profile_location(double precision, double precision) to authenticated;
grant execute on function public.clear_profile_location() to authenticated;

-- Annulation manuelle :
--   drop function if exists public.set_profile_location(double precision, double precision);
--   drop function if exists public.clear_profile_location();
