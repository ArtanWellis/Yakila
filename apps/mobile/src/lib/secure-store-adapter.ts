import * as SecureStore from "expo-secure-store";
import { createChunkedStorage } from "./chunked-storage";

/**
 * Stockage de la session Supabase dans le Keychain (iOS) / Keystore (Android), via `expo-secure-store`,
 * découpé en morceaux (voir `chunked-storage.ts`).
 *
 * `WHEN_UNLOCKED_THIS_DEVICE_ONLY` (iOS) : la session n'est lisible que téléphone déverrouillé et
 * n'est pas restaurée sur un autre appareil via une sauvegarde. Android ignore cette option.
 */
const options: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export const secureStoreAdapter = createChunkedStorage({
  getItem: (key) => SecureStore.getItemAsync(key, options),
  setItem: (key, value) => SecureStore.setItemAsync(key, value, options),
  removeItem: (key) => SecureStore.deleteItemAsync(key, options),
});
