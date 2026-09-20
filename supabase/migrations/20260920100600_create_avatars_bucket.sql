-- Avatars : bucket Storage, policies sur storage.objects, et contrainte sur profiles.avatar_url.
--
-- Un seul fichier par utilisateur, écrasé à chaque envoi : avatars/{uid}/avatar (voir avatarObjectPath dans packages/api).
--
-- Rappels Storage :
--   * bucket PUBLIC = les fichiers sont servis par URL (/storage/v1/object/public/avatars/...) sans policy `select`.
--     La lecture publique des avatars est donc assurée par `public = true`, pas par une policy.
--   * un `upload(..., { upsert: true })` exige insert + select + update sur la ligne : d'où ces trois policies (+ delete).
--   * on ne fait PAS `alter table storage.objects enable row level security` : elle l'est déjà, et la table appartient à
--     supabase_storage_admin (la commande échouerait).

-- 1) Bucket. `on conflict` : la migration peut être rejouée et remet les limites voulues.
--    2 Mo (= AVATAR_MAX_BYTES), pas de SVG (script embarqué possible) : jpeg, png, webp uniquement (= AVATAR_MIME_TYPES).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 2) Policies. Elles ne s'appliquent qu'à `authenticated` et qu'au seul objet `{uid}/avatar` de l'utilisateur.
--
--    Écart volontaire avec le contrat, plus strict :
--      * pas de policy `select` pour `anon` : elle n'est pas nécessaire à la lecture par URL (bucket public) et
--        permettrait à n'importe qui de LISTER le contenu du bucket (supabase.storage.from('avatars').list()) ;
--      * le nom de l'objet doit être exactement `{uid}/avatar` (et pas seulement « dans le dossier {uid}/ ») :
--        sans cela, un utilisateur pourrait stocker un nombre illimité de fichiers de 2 Mo sous son dossier.
--    L'expression est écrite en toutes lettres dans chaque policy : Postgres n'a pas de « macro » de policy.
create policy avatars_select_own
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'avatars' and name = ((select auth.uid())::text || '/avatar'));

create policy avatars_insert_own
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'avatars' and name = ((select auth.uid())::text || '/avatar'));

-- `with check` empêche de « déplacer » son fichier vers un autre chemin (déplacement = update du nom).
create policy avatars_update_own
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'avatars' and name = ((select auth.uid())::text || '/avatar'))
  with check (bucket_id = 'avatars' and name = ((select auth.uid())::text || '/avatar'));

create policy avatars_delete_own
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'avatars' and name = ((select auth.uid())::text || '/avatar'));

-- 3) profiles.avatar_url : null, ou l'URL publique du PROPRE avatar de l'utilisateur, éventuellement suivie de `?v=<chiffres>`
--    (paramètre de cache ajouté par uploadAvatar). Sans cela, un utilisateur pourrait faire charger à ses visiteurs
--    n'importe quelle image externe (traçage, contenu illicite).
--    Limite connue : la base ne connaît pas l'URL du projet, le nom d'hôte n'est donc pas vérifié. La contrainte impose
--    le chemin et l'identifiant de l'utilisateur, pas le domaine : un client qui écrit directement dans l'API peut donc
--    enregistrer une URL externe au bon format. Les clients doivent appeler `isTrustedAvatarUrl` (@yakila/api) avant tout
--    affichage, et le web restreint aussi next.config images.remotePatterns. Piste plus robuste, à décider : ne plus
--    stocker d'URL mais un numéro de version, l'URL étant reconstruite par chaque client depuis son SUPABASE_URL.
--    Longueur bornée à 300 : sans cela l'hôte et `?v=` sont illimités, et chaque lecture du profil renverrait la valeur.
--    `[?]` plutôt que `\?` : aucune ambiguïté d'échappement selon standard_conforming_strings.
alter table public.profiles
  add constraint profiles_avatar_url_format check (
    avatar_url is null
    or (
      char_length(avatar_url) <= 300
      and avatar_url ~ (
        '^https?://[^/?#@[:space:]]+/storage/v1/object/public/avatars/' || id::text || '/avatar([?]v=[0-9]+)?$'
      )
    )
  );

-- Annulation manuelle (les fichiers déjà envoyés restent dans le Storage : à supprimer par l'API Storage, pas en SQL) :
--   alter table public.profiles drop constraint if exists profiles_avatar_url_format;
--   drop policy if exists avatars_select_own on storage.objects;
--   drop policy if exists avatars_insert_own on storage.objects;
--   drop policy if exists avatars_update_own on storage.objects;
--   drop policy if exists avatars_delete_own on storage.objects;
--   -- le bucket se supprime depuis le Dashboard ou l'API Storage (jamais par delete SQL : les fichiers resteraient facturés).
