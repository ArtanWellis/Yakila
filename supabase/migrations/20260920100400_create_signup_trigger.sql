-- Création du profil à l'inscription.
--
-- Côté client : supabase.auth.signUp({ email, password, options: { data: { username } } }).
-- `data` atterrit dans auth.users.raw_user_meta_data. ATTENTION : cette valeur est fournie (et modifiable) par le client,
-- donc NON FIABLE. Elle n'est utilisée qu'ici, une seule fois (trigger `after insert`), après validation, et jamais pour
-- une décision d'autorisation. Une modification ultérieure via auth.updateUser({ data }) n'a aucun effet sur `profiles`.
--
-- Si le pseudo est absent, invalide ou déjà pris, la fonction lève une exception : l'insertion dans auth.users est annulée,
-- donc AUCUN compte n'est créé. GoTrue remonte alors une erreur générique (« Database error saving new user ») ;
-- le détail (invalid_username, ou duplicate key ... profiles_username_key) n'est visible que dans les logs Postgres.
--
-- Conséquences à connaître :
--   * un utilisateur créé sans `username` (bouton « Add user » du Dashboard, invitation, connexion Google / Apple,
--     connexion anonyme) est refusé : le trigger devra être revu avant d'ajouter ces méthodes ;
--   * pour créer un utilisateur de test depuis le Dashboard, renseigner {"username": "test_user"} dans « User Metadata ».
--
-- `security definer` : le trigger s'exécute avec les droits du propriétaire (postgres) pour écrire dans `public.profiles`,
-- où aucun client n'a le droit d'insérer. `search_path` vide : tous les noms sont qualifiés (public., auth.).

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- `->>` renvoie null si la clé est absente ou si raw_user_meta_data est null.
  v_username text := lower(new.raw_user_meta_data ->> 'username');
begin
  -- Même règle que profiles_username_format et USERNAME_PATTERN (packages/validation).
  if v_username is null or v_username !~ '^[a-z0-9_]{3,30}$' then
    raise exception 'invalid_username'
      using errcode = '22023',
            detail = 'raw_user_meta_data.username doit être présent et respecter ^[a-z0-9_]{3,30}$ (après passage en minuscules).';
  end if;

  -- Un pseudo déjà pris lève unique_violation (profiles_username_key), ce qui annule l'inscription.
  -- L'unicité est garantie par la contrainte, sans course possible entre deux inscriptions simultanées.
  insert into public.profiles (id, username, display_name)
  values (new.id, v_username, v_username);

  return new;
end;
$$;

-- Fonction de trigger : jamais appelable par un client (elle n'est de toute façon pas exposée : schéma `private`).
revoke all on function private.handle_new_user() from public, anon, authenticated;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Annulation manuelle (les comptes créés ensuite n'auront plus de profil) :
--   drop trigger if exists on_auth_user_created on auth.users;
--   drop function if exists private.handle_new_user();
