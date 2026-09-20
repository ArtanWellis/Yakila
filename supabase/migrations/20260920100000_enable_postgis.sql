-- PostGIS : géolocalisation (recherches par rayon, index GiST) des phases suivantes.
--
-- Rien ne l'utilise encore en phase 1 (les profils stockent de simples lat/lng en double precision) :
-- on l'active maintenant pour que les migrations des phases 3 et 4 n'aient qu'à créer des colonnes et des index.
--
-- Schéma `extensions` : recommandé par Supabase, il n'est pas exposé par l'API. Conséquence : les fonctions
-- PostGIS s'appellent `extensions.st_*` depuis une fonction dont le `search_path` est vide (ce que
-- nous imposons à toutes les fonctions `security definer`).
--
-- Pas de version explicite : Supabase ignore désormais `version` dans CREATE EXTENSION (installe la version par défaut).

create extension if not exists postgis with schema extensions;

-- Annulation manuelle (échoue s'il existe des colonnes geography/geometry) :
--   drop extension if exists postgis;
