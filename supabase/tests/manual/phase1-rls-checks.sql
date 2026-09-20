-- =====================================================================================================================
-- YaKiLa, phase 1 : verifications manuelles (RLS, privileges, RPC, trigger d'inscription, bucket avatars).
-- Remplacement provisoire des tests pgTAP (pas de base locale) : a supprimer quand supabase/tests/database/ existera.
--
-- MODE D'EMPLOI
--   1. Appliquer d'abord les migrations (pnpm exec supabase db push).
--   2. Dashboard Supabase > SQL Editor > New query, role "postgres" (par defaut). Coller TOUT le fichier, une seule
--      execution (les fonctions temporaires ne vivent que dans la session de cette execution).
--      Le Dashboard peut afficher un avertissement "destructive operation" (il y a des delete) : confirmer, tout est annule.
--   3. Lire le tableau de resultats : la premiere ligne est le RESUME, les FAIL sont listes avant les PASS.
--      La colonne "detail" montre la valeur ou l'erreur SQL obtenue (utile pour comprendre un FAIL).
--
-- CE QUE FAIT LE SCRIPT
--   * Cree deux faux comptes (alice, bob) directement dans auth.users : cela exerce aussi le trigger d'inscription.
--   * Simule chaque utilisateur avec `set local role` + `request.jwt.claims` (ce que fait PostgREST), puis note le resultat.
--   * ANNULE TOUT a la fin : le tout tourne dans une sous-transaction (exception interne capturee), meme si une verification
--     echoue. Aucune donnee de test n'est conservee (derniere ligne du rapport : "rollback"). Le script ne fait jamais de commit.
--     (On n'utilise pas un `rollback;` final : le SQL Editor n'afficherait alors que "Success", pas le rapport.)
--   * Ne modifie aucune donnee reelle. Pseudos de test : yk_check_*  ;  e-mails : *@example.invalid.
--
-- LIMITES
--   * La section E ecrit des lignes de metadonnees dans storage.objects (annulees ensuite) pour exercer les policies. Si une
--     verification E echoue avec une erreur autre que celle attendue, lire le detail : ca peut venir du schema storage
--     (triggers internes) plutot que des policies. Le test de reference des avatars reste le test reel dans l'application.
--   * Non testable ici : l'API Storage elle-meme (limite de 2 Mo, types MIME) et GoTrue (voir la liste en fin de fichier).
-- =====================================================================================================================


-- Execute `p_sql` (une requete qui renvoie UNE valeur : count(*), ... ) sous le role `p_role` avec l'identite `p_uid`,
-- puis restaure le role. Retourne 'ok:<valeur>' ou 'error:<sqlstate>:<message>'. N'echoue jamais, ce qui permet de tester
-- les refus. Pour un update / insert / delete : `with u as (update ... returning 1) select count(*) from u`.
create or replace function pg_temp.yk_as(p_role text, p_uid uuid, p_sql text)
returns text
language plpgsql
as $$
declare
  v_val text;
  v_out text;
begin
  perform set_config(
    'request.jwt.claims',
    case
      when p_uid is null then json_build_object('role', p_role)::text
      else json_build_object('sub', p_uid::text, 'role', p_role)::text
    end,
    true);
  execute format('set local role %I', p_role);
  begin
    execute p_sql into v_val;
    v_out := 'ok:' || coalesce(v_val, 'null');
  exception when others then
    v_out := 'error:' || sqlstate || ':' || sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  return v_out;
end;
$$;

-- Une ligne de rapport. Un booleen null compte comme FAIL.
create or replace function pg_temp.yk_row(p_name text, p_ok boolean, p_detail text)
returns jsonb
language sql
as $$
  select jsonb_build_object('name', p_name, 'ok', coalesce(p_ok, false), 'detail', p_detail)
$$;

create or replace function pg_temp.yk_run()
returns table (chk_num int, chk_resultat text, chk_verification text, chk_detail text)
language plpgsql
as $$
declare
  c_alice constant uuid := '11111111-1111-4111-8111-111111111111';
  c_bob   constant uuid := '22222222-2222-4222-8222-222222222222';
  c_url   constant text := 'https://exemple.supabase.co/storage/v1/object/public/avatars/';
  v_out   text;
  v_aux   text;
  v_res   jsonb := '[]'::jsonb;
  v_fail  int;
begin
  -- Tout ce bloc est annule a la fin par l exception YK001 (capturee plus bas). Les variables, elles, sont conservees.
  begin

    -- Preparation, en postgres. Le trigger d inscription cree les profils. Alice : pseudo en majuscules, pour tester la mise en minuscules.
    insert into auth.users (id, email, raw_user_meta_data)
    values (c_alice, 'yk-check-alice@example.invalid', '{"username": "YK_Check_Alice"}'),
           (c_bob,   'yk-check-bob@example.invalid',   '{"username": "yk_check_bob"}');


    ---------------------------------------------------------------------------------------------------------------
    -- A. Structure : RLS activee, privileges, fonctions, trigger, bucket
    ---------------------------------------------------------------------------------------------------------------
    v_res := v_res || pg_temp.yk_row('A1 RLS activee sur public.profiles',
      (select c.relrowsecurity from pg_class c where c.oid = 'public.profiles'::regclass), null);

    v_res := v_res || pg_temp.yk_row('A2 RLS activee sur public.profile_private',
      (select c.relrowsecurity from pg_class c where c.oid = 'public.profile_private'::regclass), null);

    v_res := v_res || pg_temp.yk_row('A3 profiles : anon lit, sans aucun droit d ecriture',
      has_table_privilege('anon', 'public.profiles', 'select')
      and not has_any_column_privilege('anon', 'public.profiles', 'insert')
      and not has_any_column_privilege('anon', 'public.profiles', 'update')
      and not has_table_privilege('anon', 'public.profiles', 'delete'), null);

    select string_agg(a.attname::text, ',' order by a.attname::text) into v_out
      from pg_attribute a
     where a.attrelid = 'public.profiles'::regclass
       and a.attnum > 0
       and not a.attisdropped
       and has_column_privilege('authenticated', 'public.profiles', a.attname::text, 'update');
    v_res := v_res || pg_temp.yk_row('A4 profiles : authenticated ne peut modifier que avatar_url, bio, city, display_name',
      v_out = 'avatar_url,bio,city,display_name', v_out);

    v_res := v_res || pg_temp.yk_row('A5 profiles : authenticated ne peut ni inserer ni supprimer',
      not has_any_column_privilege('authenticated', 'public.profiles', 'insert')
      and not has_table_privilege('authenticated', 'public.profiles', 'delete'), null);

    v_res := v_res || pg_temp.yk_row('A6 profile_private : authenticated lit seulement, anon rien',
      has_table_privilege('authenticated', 'public.profile_private', 'select')
      and not has_any_column_privilege('authenticated', 'public.profile_private', 'insert')
      and not has_any_column_privilege('authenticated', 'public.profile_private', 'update')
      and not has_table_privilege('authenticated', 'public.profile_private', 'delete')
      and not has_any_column_privilege('anon', 'public.profile_private', 'select'), null);

    v_res := v_res || pg_temp.yk_row('A7 RPC set_profile_location : execute pour authenticated, pas pour anon',
      has_function_privilege('authenticated', 'public.set_profile_location(double precision, double precision)', 'execute')
      and not has_function_privilege('anon', 'public.set_profile_location(double precision, double precision)', 'execute'), null);

    v_res := v_res || pg_temp.yk_row('A8 RPC clear_profile_location : execute pour authenticated, pas pour anon',
      has_function_privilege('authenticated', 'public.clear_profile_location()', 'execute')
      and not has_function_privilege('anon', 'public.clear_profile_location()', 'execute'), null);

    select count(*)::text into v_out
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where ((n.nspname = 'private' and p.proname in ('set_updated_at', 'handle_new_user'))
         or (n.nspname = 'public' and p.proname in ('set_profile_location', 'clear_profile_location')))
       and exists (select 1 from unnest(p.proconfig) as cfg
                    where cfg like 'search_path=%' and replace(substr(cfg, 13), '"', '') = '');
    v_res := v_res || pg_temp.yk_row('A9 les 4 fonctions ont un search_path vide', v_out = '4', v_out || ' sur 4');

    select count(*)::text into v_out
      from pg_trigger t
     where t.tgrelid = 'auth.users'::regclass
       and t.tgname = 'on_auth_user_created'
       and not t.tgisinternal
       and t.tgenabled = 'O';
    v_res := v_res || pg_temp.yk_row('A10 trigger d inscription on_auth_user_created actif sur auth.users', v_out = '1', v_out);

    select (b.public and b.file_size_limit = 2097152
            and b.allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'])::text into v_out
      from storage.buckets b
     where b.id = 'avatars';
    v_res := v_res || pg_temp.yk_row('A11 bucket avatars : public, 2 Mo, jpeg / png / webp',
      v_out = 'true', coalesce(v_out, 'bucket absent'));

    select count(*)::text || '/' || count(distinct p.cmd)::text into v_out
      from pg_policies p
     where p.schemaname = 'storage'
       and p.tablename = 'objects'
       and left(p.policyname, 8) = 'avatars_'
       and p.roles = array['authenticated']::name[];
    v_res := v_res || pg_temp.yk_row('A12 storage : 4 policies avatars_* (select, insert, update, delete), authenticated seulement',
      v_out = '4/4', v_out);


    ---------------------------------------------------------------------------------------------------------------
    -- B. Inscription : le trigger valide le pseudo (fourni par le client, donc non fiable)
    ---------------------------------------------------------------------------------------------------------------
    select username || '|' || display_name into v_out from public.profiles where id = c_alice;
    v_res := v_res || pg_temp.yk_row('B1 pseudo mis en minuscules, display_name initialise avec le pseudo',
      v_out = 'yk_check_alice|yk_check_alice', v_out);

    v_out := pg_temp.yk_as('postgres', null, $q$
      insert into auth.users (id, email, raw_user_meta_data)
      values (gen_random_uuid(), 'yk-check-b2@example.invalid', '{}') returning 1 $q$);
    v_res := v_res || pg_temp.yk_row('B2 inscription refusee sans pseudo', v_out like 'error:22023:%', v_out);

    v_out := pg_temp.yk_as('postgres', null, $q$
      insert into auth.users (id, email, raw_user_meta_data)
      values (gen_random_uuid(), 'yk-check-b3@example.invalid', '{"username": "ab"}') returning 1 $q$);
    v_res := v_res || pg_temp.yk_row('B3 inscription refusee : pseudo trop court', v_out like 'error:22023:%', v_out);

    v_out := pg_temp.yk_as('postgres', null, $q$
      insert into auth.users (id, email, raw_user_meta_data)
      values (gen_random_uuid(), 'yk-check-b4@example.invalid', '{"username": "Bad Name!"}') returning 1 $q$);
    v_res := v_res || pg_temp.yk_row('B4 inscription refusee : caracteres invalides', v_out like 'error:22023:%', v_out);

    v_out := pg_temp.yk_as('postgres', null, format($q$
      insert into auth.users (id, email, raw_user_meta_data)
      values (gen_random_uuid(), 'yk-check-b5@example.invalid', %L) returning 1 $q$,
      '{"username": "' || repeat('a', 31) || '"}'));
    v_res := v_res || pg_temp.yk_row('B5 inscription refusee : pseudo de 31 caracteres', v_out like 'error:22023:%', v_out);

    v_out := pg_temp.yk_as('postgres', null, format($q$
      insert into auth.users (id, email, raw_user_meta_data)
      values (gen_random_uuid(), 'yk-check-b6@example.invalid', %L) returning 1 $q$,
      '{"username": "' || repeat('a', 30) || '"}'));
    v_res := v_res || pg_temp.yk_row('B6 inscription acceptee : pseudo de 30 caracteres', v_out = 'ok:1', v_out);

    v_out := pg_temp.yk_as('postgres', null, $q$
      insert into auth.users (id, email, raw_user_meta_data)
      values (gen_random_uuid(), 'yk-check-b7@example.invalid', '{"username": "YK_CHECK_BOB"}') returning 1 $q$);
    v_res := v_res || pg_temp.yk_row('B7 inscription refusee : pseudo deja pris (insensible a la casse)',
      v_out like 'error:23505:%profiles_username_key%', v_out);


    ---------------------------------------------------------------------------------------------------------------
    -- C. profiles : lecture publique, modification par le proprietaire seulement, contraintes
    ---------------------------------------------------------------------------------------------------------------
    v_out := pg_temp.yk_as('anon', null,
      format('select count(*) from public.profiles where id in (%L, %L)', c_alice, c_bob));
    v_res := v_res || pg_temp.yk_row('C1 anon lit les profils', v_out = 'ok:2', v_out);

    v_out := pg_temp.yk_as('authenticated', c_alice,
      format('select count(*) from public.profiles where id = %L', c_bob));
    v_res := v_res || pg_temp.yk_row('C2 alice lit le profil de bob', v_out = 'ok:1', v_out);

    v_out := pg_temp.yk_as('authenticated', c_alice, format($q$
      with u as (update public.profiles set display_name = 'Alice', bio = 'Bio', city = 'Paris'
                  where id = %L returning 1)
      select count(*) from u $q$, c_alice));
    v_res := v_res || pg_temp.yk_row('C3 alice modifie display_name, bio, city de son profil', v_out = 'ok:1', v_out);

    v_aux := pg_temp.yk_as('authenticated', c_alice, format($q$
      with u as (update public.profiles set display_name = 'pwned' where id = %L returning 1)
      select count(*) from u $q$, c_bob));
    select display_name into v_out from public.profiles where id = c_bob;
    v_res := v_res || pg_temp.yk_row('C4 alice ne peut pas modifier le profil de bob (0 ligne, valeur inchangee)',
      v_aux = 'ok:0' and v_out = 'yk_check_bob', v_aux || ' / display_name de bob = ' || coalesce(v_out, 'null'));

    v_out := pg_temp.yk_as('authenticated', c_alice, format($q$
      with u as (update public.profiles set username = 'yk_check_hack' where id = %L returning 1)
      select count(*) from u $q$, c_alice));
    v_res := v_res || pg_temp.yk_row('C5 alice ne peut pas modifier username (immuable)',
      v_out like 'error:42501:permission denied for table profiles%', v_out);

    v_out := pg_temp.yk_as('authenticated', c_alice, format($q$
      with u as (update public.profiles set approx_lat = 10, approx_lng = 10 where id = %L returning 1)
      select count(*) from u $q$, c_alice));
    v_res := v_res || pg_temp.yk_row('C6 alice ne peut pas ecrire approx_lat / approx_lng directement',
      v_out like 'error:42501:permission denied for table profiles%', v_out);

    v_out := pg_temp.yk_as('authenticated', c_alice,
      $q$ insert into public.profiles (id, username) values (gen_random_uuid(), 'yk_check_x') returning 1 $q$);
    v_res := v_res || pg_temp.yk_row('C7 alice ne peut pas inserer dans profiles',
      v_out like 'error:42501:permission denied for table profiles%', v_out);

    v_out := pg_temp.yk_as('authenticated', c_alice, format($q$
      with d as (delete from public.profiles where id = %L returning 1)
      select count(*) from d $q$, c_alice));
    v_res := v_res || pg_temp.yk_row('C8 alice ne peut pas supprimer son profil',
      v_out like 'error:42501:permission denied for table profiles%', v_out);

    v_out := pg_temp.yk_as('anon', null, format($q$
      with u as (update public.profiles set display_name = 'x' where id = %L returning 1)
      select count(*) from u $q$, c_alice));
    v_res := v_res || pg_temp.yk_row('C9 anon ne peut rien modifier',
      v_out like 'error:42501:permission denied for table profiles%', v_out);

    v_out := pg_temp.yk_as('authenticated', c_alice, format($q$
      with u as (update public.profiles set bio = repeat('x', 501) where id = %L returning 1)
      select count(*) from u $q$, c_alice));
    v_res := v_res || pg_temp.yk_row('C10 bio de 501 caracteres refusee', v_out like 'error:23514:%profiles_bio_length%', v_out);

    v_out := pg_temp.yk_as('authenticated', c_alice, format($q$
      with u as (update public.profiles set display_name = repeat('x', 51) where id = %L returning 1)
      select count(*) from u $q$, c_alice));
    v_res := v_res || pg_temp.yk_row('C11 display_name de 51 caracteres refuse',
      v_out like 'error:23514:%profiles_display_name_length%', v_out);

    v_out := pg_temp.yk_as('authenticated', c_alice, format($q$
      with u as (update public.profiles set city = repeat('x', 101) where id = %L returning 1)
      select count(*) from u $q$, c_alice));
    v_res := v_res || pg_temp.yk_row('C12 city de 101 caracteres refusee', v_out like 'error:23514:%profiles_city_length%', v_out);

    v_out := pg_temp.yk_as('authenticated', c_alice, format($q$
      with u as (update public.profiles set display_name = '' where id = %L returning 1)
      select count(*) from u $q$, c_alice));
    v_res := v_res || pg_temp.yk_row('C13 display_name vide refuse (les clients envoient null)',
      v_out like 'error:23514:%profiles_display_name_length%', v_out);

    v_out := pg_temp.yk_as('postgres', null, format($q$
      with u as (update public.profiles set username = 'Bad-Name' where id = %L returning 1)
      select count(*) from u $q$, c_alice));
    v_res := v_res || pg_temp.yk_row('C14 username hors format refuse par la base (meme pour postgres)',
      v_out like 'error:23514:%profiles_username_format%', v_out);

    v_out := pg_temp.yk_as('postgres', null, format($q$
      with u as (update public.profiles set username = 'yk_check_bob' where id = %L returning 1)
      select count(*) from u $q$, c_alice));
    v_res := v_res || pg_temp.yk_row('C15 username en double refuse par la base',
      v_out like 'error:23505:%profiles_username_key%', v_out);

    v_out := pg_temp.yk_as('postgres', null, format($q$
      with u as (update public.profiles set approx_lat = 10 where id = %L returning 1)
      select count(*) from u $q$, c_alice));
    v_res := v_res || pg_temp.yk_row('C16 approx_lat sans approx_lng refuse par la base',
      v_out like 'error:23514:%profiles_approx_position_pair%', v_out);

    v_out := pg_temp.yk_as('postgres', null, format($q$
      with u as (update public.profiles set approx_lat = 91, approx_lng = 0 where id = %L returning 1)
      select count(*) from u $q$, c_alice));
    v_res := v_res || pg_temp.yk_row('C17 approx_lat hors limites refuse par la base',
      v_out like 'error:23514:%profiles_approx_lat_range%', v_out);

    v_out := pg_temp.yk_as('authenticated', c_alice, format($q$
      with u as (update public.profiles set avatar_url = 'https://evil.example/avatar.png' where id = %L returning 1)
      select count(*) from u $q$, c_alice));
    v_res := v_res || pg_temp.yk_row('C18 avatar_url : image externe refusee',
      v_out like 'error:23514:%profiles_avatar_url_format%', v_out);

    v_out := pg_temp.yk_as('authenticated', c_alice, format($q$
      with u as (update public.profiles set avatar_url = %L where id = %L returning 1)
      select count(*) from u $q$, c_url || c_bob::text || '/avatar', c_alice));
    v_res := v_res || pg_temp.yk_row('C19 avatar_url : avatar d un autre utilisateur refuse',
      v_out like 'error:23514:%profiles_avatar_url_format%', v_out);

    v_out := pg_temp.yk_as('authenticated', c_alice, format($q$
      with u as (update public.profiles set avatar_url = %L where id = %L returning 1)
      select count(*) from u $q$, c_url || c_alice::text || '/avatar?v=abc', c_alice));
    v_res := v_res || pg_temp.yk_row('C20 avatar_url : parametre ?v= non numerique refuse',
      v_out like 'error:23514:%profiles_avatar_url_format%', v_out);

    v_out := pg_temp.yk_as('authenticated', c_alice, format($q$
      with u as (update public.profiles set avatar_url = %L where id = %L returning 1)
      select count(*) from u $q$, c_url || c_alice::text || '/avatar', c_alice));
    v_res := v_res || pg_temp.yk_row('C21 avatar_url : propre avatar accepte', v_out = 'ok:1', v_out);

    v_out := pg_temp.yk_as('authenticated', c_alice, format($q$
      with u as (update public.profiles set avatar_url = %L where id = %L returning 1)
      select count(*) from u $q$, c_url || c_alice::text || '/avatar?v=1758380000000', c_alice));
    v_res := v_res || pg_temp.yk_row('C22 avatar_url : propre avatar avec ?v=<chiffres> accepte', v_out = 'ok:1', v_out);

    v_out := pg_temp.yk_as('authenticated', c_alice, format($q$
      with u as (update public.profiles set avatar_url = null where id = %L returning 1)
      select count(*) from u $q$, c_alice));
    v_res := v_res || pg_temp.yk_row('C23 avatar_url : null accepte', v_out = 'ok:1', v_out);

    -- Le trigger updated_at ecrase la valeur fournie (now() est constant dans une transaction : on part d une date ancienne).
    v_out := pg_temp.yk_as('postgres', null, format($q$
      update public.profiles set updated_at = '2000-01-01', bio = 'trigger'
       where id = %L returning (updated_at > '2000-01-01')::text $q$, c_alice));
    v_res := v_res || pg_temp.yk_row('C24 trigger updated_at sur profiles', v_out = 'ok:true', v_out);


    ---------------------------------------------------------------------------------------------------------------
    -- D. Localisation : RPC, arrondi, confidentialite de la position exacte
    ---------------------------------------------------------------------------------------------------------------
    v_out := pg_temp.yk_as('authenticated', c_alice,
      'select count(*) from (select public.set_profile_location(48.85661, 2.35222)) s');
    v_res := v_res || pg_temp.yk_row('D1 alice enregistre sa position via la RPC', v_out = 'ok:1', v_out);

    select (abs(exact_lat - 48.85661) < 1e-9 and abs(exact_lng - 2.35222) < 1e-9)::text into v_out
      from public.profile_private where id = c_alice;
    v_res := v_res || pg_temp.yk_row('D2 position EXACTE conservee telle quelle dans profile_private',
      v_out = 'true', coalesce(v_out, 'ligne absente'));

    select (abs(approx_lat - 48.86) < 1e-9 and abs(approx_lng - 2.35) < 1e-9)::text into v_out
      from public.profiles where id = c_alice;
    v_res := v_res || pg_temp.yk_row('D3 position PUBLIQUE arrondie a 2 decimales (48.85661, 2.35222 -> 48.86, 2.35)',
      v_out = 'true', coalesce(v_out, 'ligne absente'));

    v_out := pg_temp.yk_as('authenticated', c_alice, 'select count(*) from public.profile_private');
    v_res := v_res || pg_temp.yk_row('D4 alice lit sa propre position exacte (1 ligne visible)', v_out = 'ok:1', v_out);

    v_out := pg_temp.yk_as('authenticated', c_bob,
      'select count(*) from (select public.set_profile_location(-33.8688, 151.2093)) s');
    v_res := v_res || pg_temp.yk_row('D5 bob enregistre sa position via la RPC', v_out = 'ok:1', v_out);

    select (abs(approx_lat - (-33.87)) < 1e-9 and abs(approx_lng - 151.21) < 1e-9)::text into v_out
      from public.profiles where id = c_bob;
    v_res := v_res || pg_temp.yk_row('D6 arrondi avec valeurs negatives (-33.8688, 151.2093 -> -33.87, 151.21)',
      v_out = 'true', coalesce(v_out, 'ligne absente'));

    v_out := pg_temp.yk_as('authenticated', c_bob,
      format('select count(*) from public.profile_private where id = %L', c_alice));
    v_res := v_res || pg_temp.yk_row('D7 bob ne peut pas lire la position exacte d alice (0 ligne)', v_out = 'ok:0', v_out);

    v_out := pg_temp.yk_as('authenticated', c_bob, 'select count(*) from public.profile_private');
    v_res := v_res || pg_temp.yk_row('D8 bob ne voit que sa propre ligne dans profile_private (alice existe aussi)',
      v_out = 'ok:1', v_out);

    v_out := pg_temp.yk_as('anon', null, 'select count(*) from public.profile_private');
    v_res := v_res || pg_temp.yk_row('D9 anon ne peut pas lire profile_private',
      v_out like 'error:42501:permission denied for table profile_private%', v_out);

    v_out := pg_temp.yk_as('authenticated', c_alice, format($q$
      insert into public.profile_private (id, exact_lat, exact_lng) values (%L, 0, 0) returning 1 $q$, c_alice));
    v_res := v_res || pg_temp.yk_row('D10 alice ne peut pas inserer dans profile_private',
      v_out like 'error:42501:permission denied for table profile_private%', v_out);

    v_out := pg_temp.yk_as('authenticated', c_alice, format($q$
      with u as (update public.profile_private set exact_lat = 0 where id = %L returning 1)
      select count(*) from u $q$, c_alice));
    v_res := v_res || pg_temp.yk_row('D11 alice ne peut pas modifier profile_private directement',
      v_out like 'error:42501:permission denied for table profile_private%', v_out);

    v_out := pg_temp.yk_as('authenticated', c_alice, format($q$
      with d as (delete from public.profile_private where id = %L returning 1)
      select count(*) from d $q$, c_alice));
    v_res := v_res || pg_temp.yk_row('D12 alice ne peut pas supprimer dans profile_private directement',
      v_out like 'error:42501:permission denied for table profile_private%', v_out);

    v_out := pg_temp.yk_as('authenticated', c_alice,
      'select count(*) from (select public.set_profile_location(91, 0)) s');
    v_res := v_res || pg_temp.yk_row('D13 RPC : latitude 91 refusee', v_out like 'error:22023:invalid_coordinates%', v_out);

    v_out := pg_temp.yk_as('authenticated', c_alice,
      'select count(*) from (select public.set_profile_location(0, 181)) s');
    v_res := v_res || pg_temp.yk_row('D14 RPC : longitude 181 refusee', v_out like 'error:22023:invalid_coordinates%', v_out);

    v_out := pg_temp.yk_as('authenticated', c_alice,
      $q$ select count(*) from (select public.set_profile_location('NaN'::double precision, 0)) s $q$);
    v_res := v_res || pg_temp.yk_row('D15 RPC : NaN refuse', v_out like 'error:22023:invalid_coordinates%', v_out);

    v_out := pg_temp.yk_as('authenticated', c_alice,
      'select count(*) from (select public.set_profile_location(null, 0)) s');
    v_res := v_res || pg_temp.yk_row('D16 RPC : null refuse', v_out like 'error:22023:invalid_coordinates%', v_out);

    select (abs(p.exact_lat - 48.85661) < 1e-9 and abs(pr.approx_lat - 48.86) < 1e-9)::text into v_out
      from public.profile_private p
      join public.profiles pr on pr.id = p.id
     where p.id = c_alice;
    v_res := v_res || pg_temp.yk_row('D17 position d alice inchangee apres les appels invalides',
      v_out = 'true', coalesce(v_out, 'ligne absente'));

    v_out := pg_temp.yk_as('anon', null,
      'select count(*) from (select public.set_profile_location(1, 1)) s');
    v_res := v_res || pg_temp.yk_row('D18 anon ne peut pas appeler set_profile_location',
      v_out like 'error:42501:permission denied for function set_profile_location%', v_out);

    v_out := pg_temp.yk_as('anon', null,
      'select count(*) from (select public.clear_profile_location()) s');
    v_res := v_res || pg_temp.yk_row('D19 anon ne peut pas appeler clear_profile_location',
      v_out like 'error:42501:permission denied for function clear_profile_location%', v_out);

    -- Role `authenticated` mais JWT sans `sub` : auth.uid() est null, le corps de la fonction refuse.
    v_out := pg_temp.yk_as('authenticated', null,
      'select count(*) from (select public.set_profile_location(1, 1)) s');
    v_res := v_res || pg_temp.yk_row('D20 RPC : refusee sans identite (auth.uid() null)',
      v_out like 'error:28000:not_authenticated%', v_out);

    v_out := pg_temp.yk_as('postgres', null, format($q$
      update public.profile_private set updated_at = '2000-01-01'
       where id = %L returning (updated_at > '2000-01-01')::text $q$, c_bob));
    v_res := v_res || pg_temp.yk_row('D21 trigger updated_at sur profile_private', v_out = 'ok:true', v_out);

    v_out := pg_temp.yk_as('authenticated', c_alice,
      'select count(*) from (select public.clear_profile_location()) s');
    v_res := v_res || pg_temp.yk_row('D22 alice efface sa position via la RPC', v_out = 'ok:1', v_out);

    select (select count(*) from public.profile_private where id = c_alice)::text || '|'
        || (select count(*) from public.profiles where id = c_alice and approx_lat is null and approx_lng is null)::text
      into v_out;
    v_res := v_res || pg_temp.yk_row('D23 apres effacement : plus de ligne privee, approx_* remis a null (0|1)',
      v_out = '0|1', v_out);


    ---------------------------------------------------------------------------------------------------------------
    -- E. Storage : policies du bucket avatars (lignes de metadonnees ecrites directement, annulees ensuite)
    ---------------------------------------------------------------------------------------------------------------
    v_out := pg_temp.yk_as('authenticated', c_alice, format($q$
      insert into storage.objects (bucket_id, name) values ('avatars', %L) returning 1 $q$, c_alice::text || '/avatar'));
    v_res := v_res || pg_temp.yk_row('E1 alice envoie {son id}/avatar', v_out = 'ok:1', v_out);

    v_out := pg_temp.yk_as('authenticated', c_alice, format($q$
      insert into storage.objects (bucket_id, name) values ('avatars', %L) returning 1 $q$, c_bob::text || '/avatar'));
    v_res := v_res || pg_temp.yk_row('E2 alice ne peut pas envoyer dans le dossier de bob',
      v_out like 'error:42501:new row violates row-level security policy%', v_out);

    v_out := pg_temp.yk_as('authenticated', c_alice, format($q$
      insert into storage.objects (bucket_id, name) values ('avatars', %L) returning 1 $q$, c_alice::text || '/autre.png'));
    v_res := v_res || pg_temp.yk_row('E3 alice ne peut envoyer que {son id}/avatar (pas d autre nom dans son dossier)',
      v_out like 'error:42501:new row violates row-level security policy%', v_out);

    v_out := pg_temp.yk_as('anon', null, format($q$
      insert into storage.objects (bucket_id, name) values ('avatars', %L) returning 1 $q$, c_alice::text || '/avatar'));
    v_res := v_res || pg_temp.yk_row('E4 anon ne peut rien envoyer', v_out like 'error:42501:%', v_out);

    -- Fixture : l avatar de bob, insere en postgres (contourne la RLS).
    v_out := pg_temp.yk_as('postgres', null, format($q$
      insert into storage.objects (bucket_id, name) values ('avatars', %L) returning 1 $q$, c_bob::text || '/avatar'));
    v_res := v_res || pg_temp.yk_row('E5 preparation : avatar de bob insere en postgres', v_out = 'ok:1', v_out);

    v_out := pg_temp.yk_as('authenticated', c_alice, $q$ select count(*) from storage.objects where bucket_id = 'avatars' $q$);
    v_res := v_res || pg_temp.yk_row('E6 alice ne liste que son propre avatar (pas celui de bob)', v_out = 'ok:1', v_out);

    v_out := pg_temp.yk_as('anon', null, $q$ select count(*) from storage.objects where bucket_id = 'avatars' $q$);
    v_res := v_res || pg_temp.yk_row('E7 anon ne peut pas lister le bucket (lecture publique = par URL uniquement)',
      v_out = 'ok:0' or v_out like 'error:42501:%', v_out);

    v_out := pg_temp.yk_as('authenticated', c_alice, format($q$
      with u as (update storage.objects set metadata = '{}'::jsonb
                  where bucket_id = 'avatars' and name = %L returning 1)
      select count(*) from u $q$, c_alice::text || '/avatar'));
    v_res := v_res || pg_temp.yk_row('E8 alice peut mettre a jour son avatar (necessaire a l upsert)', v_out = 'ok:1', v_out);

    v_out := pg_temp.yk_as('authenticated', c_alice, format($q$
      with u as (update storage.objects set metadata = '{}'::jsonb
                  where bucket_id = 'avatars' and name = %L returning 1)
      select count(*) from u $q$, c_bob::text || '/avatar'));
    v_res := v_res || pg_temp.yk_row('E9 alice ne peut pas modifier l avatar de bob (0 ligne)', v_out = 'ok:0', v_out);

    v_out := pg_temp.yk_as('authenticated', c_alice, format($q$
      update storage.objects set name = %L
       where bucket_id = 'avatars' and name = %L returning 1 $q$, c_alice::text || '/deplace', c_alice::text || '/avatar'));
    v_res := v_res || pg_temp.yk_row('E10 alice ne peut pas renommer / deplacer son avatar',
      v_out like 'error:42501:new row violates row-level security policy%', v_out);


    ---------------------------------------------------------------------------------------------------------------
    -- F. Suppression de compte : la cascade emporte le profil et la position privee
    ---------------------------------------------------------------------------------------------------------------
    v_out := pg_temp.yk_as('postgres', null, format($q$
      with d as (delete from auth.users where id = %L returning 1)
      select count(*) from d $q$, c_bob));
    v_res := v_res || pg_temp.yk_row('F1 suppression du compte de bob', v_out = 'ok:1', v_out);

    select ((select count(*) from public.profiles where id = c_bob)
          + (select count(*) from public.profile_private where id = c_bob))::text into v_out;
    v_res := v_res || pg_temp.yk_row('F2 cascade : profil et position privee de bob supprimes', v_out = '0', v_out);

    -- Annule tout ce qui precede (sous-transaction).
    raise exception 'yk_rollback' using errcode = 'YK001';
  exception
    when sqlstate 'YK001' then
      null;
  end;

  -- Apres le rollback, en dehors de la sous-transaction : rien ne doit rester.
  select count(*)::text into v_out from auth.users where id in (c_alice, c_bob);
  v_res := v_res || pg_temp.yk_row('Z1 rollback : aucun utilisateur de test conserve', v_out = '0', v_out || ' restant(s)');

  select count(*)::text into v_out
    from storage.objects
   where bucket_id = 'avatars'
     and (name like '11111111-%' or name like '22222222-%');
  v_res := v_res || pg_temp.yk_row('Z2 rollback : aucun objet de test conserve dans storage.objects', v_out = '0', v_out || ' restant(s)');

  select count(*) filter (where not (e ->> 'ok')::boolean)::int into v_fail from jsonb_array_elements(v_res) e;

  -- Premiere ligne : le resume.
  return query
  select 0::int,
         (case when v_fail = 0 then 'PASS' else 'FAIL' end)::text,
         'RESUME'::text,
         ((jsonb_array_length(v_res) - v_fail)::text || ' PASS, ' || v_fail::text || ' FAIL')::text;

  -- Puis les FAIL d abord, les PASS ensuite (dans l ordre d execution).
  return query
  select t.i::int,
         (case when (t.e ->> 'ok')::boolean then 'PASS' else 'FAIL' end)::text,
         (t.e ->> 'name')::text,
         (t.e ->> 'detail')::text
    from jsonb_array_elements(v_res) with ordinality as t(e, i)
   order by (t.e ->> 'ok')::boolean, t.i;
end;
$$;

select chk_num as "#", chk_resultat as "resultat", chk_verification as "verification", chk_detail as "detail"
  from pg_temp.yk_run();


-- =====================================================================================================================
-- A VERIFIER A LA MAIN (non couvert par ce script), avec deux vrais comptes A et B dans l'application :
--   1. Inscription avec un pseudo deja pris : le formulaire doit afficher un message clair (GoTrue renvoie une erreur
--      generique "Database error saving new user").
--   2. Envoi d'un avatar de plus de 2 Mo, d'un SVG, d'un PDF : refuses par le bucket.
--   3. Avec la session de A, envoi vers le chemin de B (requete Storage manuelle, ex. curl avec le jeton de A) : 403 / RLS.
--   4. Sans session (cle publishable seule) : storage.from('avatars').list() renvoie une liste vide ; l'URL publique de
--      l'avatar de A s'affiche dans un navigateur non connecte.
--   5. Remplacer deux fois l'avatar de A (upsert) : pas d'erreur, l'ancienne image n'est plus servie (parametre ?v=).
--   6. Dashboard > Advisors > Security et Performance : aucun avertissement sur profiles / profile_private / les RPC.
-- =====================================================================================================================
