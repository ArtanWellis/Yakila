// Doit rester le premier import : supabase-js utilise `URL` / `URLSearchParams`, incomplets dans
// React Native. Le polyfill est chargé ici, avant la création du client.
import "react-native-url-polyfill/auto";

import { createSupabaseClient } from "@yakila/api";
import { secureStoreAdapter } from "./secure-store-adapter";

// Expo remplace `process.env.EXPO_PUBLIC_*` au moment du bundle : il faut les écrire tels quels
// (pas de déstructuration ni de clé dynamique). Ces valeurs sont publiques par construction :
// URL du projet et clé anon/publishable. Jamais de clé service role dans l'application.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "EXPO_PUBLIC_SUPABASE_URL et EXPO_PUBLIC_SUPABASE_ANON_KEY doivent être définies dans apps/mobile/.env.",
  );
}

export const supabase = createSupabaseClient(url, anonKey, {
  auth: {
    storage: secureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    // Pas d'URL de navigateur en mobile : la session ne se récupère pas depuis l'URL.
    detectSessionInUrl: false,
  },
});
