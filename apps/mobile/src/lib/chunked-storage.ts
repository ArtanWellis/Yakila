/**
 * Stockage clé/valeur asynchrone minimal : c'est la forme que `supabase-js` attend pour `auth.storage`.
 */
export interface AsyncKeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/**
 * Taille maximale d'un morceau, en octets UTF-8. `expo-secure-store` ne fixe pas de limite mais
 * la doc signale que certaines versions d'iOS refusent les valeurs au-delà d'environ 2048 octets
 * (Keychain), et une session Supabase (JWT + refresh token + utilisateur) les dépasse souvent.
 */
export const MAX_CHUNK_BYTES = 1800;

/** Garde-fou contre un manifeste corrompu : 64 morceaux de 1800 octets, soit environ 115 Ko. */
const MAX_CHUNKS = 64;
const MANIFEST_VERSION = 1;

interface Manifest {
  v: typeof MANIFEST_VERSION;
  /** Identifiant de génération : les morceaux d'une écriture partagent le même. */
  id: string;
  /** Nombre de morceaux. */
  n: number;
}

function utf8Length(char: string): number {
  const codePoint = char.codePointAt(0) ?? 0;
  if (codePoint < 0x80) return 1;
  if (codePoint < 0x800) return 2;
  if (codePoint < 0x10000) return 3;
  return 4;
}

/**
 * Découpe une chaîne en morceaux de `maxBytes` octets UTF-8 au plus. Le découpage se fait par
 * point de code, jamais au milieu d'une paire de substitution ; `parts.join("")` redonne la valeur.
 */
export function splitIntoChunks(value: string, maxBytes: number = MAX_CHUNK_BYTES): string[] {
  const chunks: string[] = [];
  let current = "";
  let currentBytes = 0;
  for (const char of value) {
    const bytes = utf8Length(char);
    if (current !== "" && currentBytes + bytes > maxBytes) {
      chunks.push(current);
      current = "";
      currentBytes = 0;
    }
    current += char;
    currentBytes += bytes;
  }
  if (current !== "") chunks.push(current);
  return chunks;
}

function parseManifest(raw: string | null): Manifest | null {
  if (raw === null) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return null;
    const { v, id, n } = value as Record<string, unknown>;
    if (v !== MANIFEST_VERSION) return null;
    // `id` entre dans des noms de clés : SecureStore n'accepte que [A-Za-z0-9._-].
    if (typeof id !== "string" || !/^[a-z0-9]+$/.test(id)) return null;
    if (typeof n !== "number" || !Number.isInteger(n) || n < 0 || n > MAX_CHUNKS) return null;
    return { v, id, n };
  } catch {
    return null;
  }
}

function chunkKey(key: string, id: string, index: number): string {
  return `${key}.${id}.${index}`;
}

function defaultGenerationId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

async function removeChunks(store: AsyncKeyValueStore, key: string, manifest: Manifest) {
  const removals = Array.from({ length: manifest.n }, (_, index) =>
    store.removeItem(chunkKey(key, manifest.id, index)),
  );
  // Nettoyage au mieux : un morceau orphelin ne casse rien, il ne sera simplement plus lu.
  await Promise.allSettled(removals);
}

export interface ChunkedStorageOptions {
  maxChunkBytes?: number;
  /** Injectable pour les tests. */
  newGenerationId?: () => string;
}

/**
 * Enveloppe un stockage limité en taille de valeur pour y ranger des valeurs plus longues.
 *
 * Disposition : la clé `key` contient un petit manifeste JSON `{ v, id, n }` ; les morceaux sont
 * stockés sous `key.<id>.<index>`. Une écriture crée d'abord tous ses morceaux sous un nouvel `id`,
 * puis remplace le manifeste (point de validation), puis supprime l'ancienne génération. Si
 * l'application est tuée en cours d'écriture, le manifeste pointe encore vers l'ancienne génération
 * complète : la session n'est jamais lue à moitié écrite.
 */
export function createChunkedStorage(
  store: AsyncKeyValueStore,
  options: ChunkedStorageOptions = {},
): AsyncKeyValueStore {
  const maxChunkBytes = options.maxChunkBytes ?? MAX_CHUNK_BYTES;
  const newGenerationId = options.newGenerationId ?? defaultGenerationId;

  return {
    async getItem(key) {
      const manifest = parseManifest(await store.getItem(key));
      if (manifest === null) return null;
      const parts = await Promise.all(
        Array.from({ length: manifest.n }, (_, index) =>
          store.getItem(chunkKey(key, manifest.id, index)),
        ),
      );
      // Un morceau manquant : valeur inutilisable, on la traite comme absente (utilisateur déconnecté).
      if (parts.some((part) => part === null)) return null;
      return parts.join("");
    },

    async setItem(key, value) {
      const previous = parseManifest(await store.getItem(key));
      const id = newGenerationId();
      const chunks = splitIntoChunks(value, maxChunkBytes);
      await Promise.all(
        chunks.map((chunk, index) => store.setItem(chunkKey(key, id, index), chunk)),
      );

      const manifest: Manifest = { v: MANIFEST_VERSION, id, n: chunks.length };
      await store.setItem(key, JSON.stringify(manifest));

      if (previous !== null && previous.id !== id) await removeChunks(store, key, previous);
    },

    async removeItem(key) {
      const previous = parseManifest(await store.getItem(key));
      await store.removeItem(key);
      if (previous !== null) await removeChunks(store, key, previous);
    },
  };
}
