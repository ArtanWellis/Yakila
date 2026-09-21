/** Délai d'attente d'un appel réseau ordinaire (connexion, profil…). */
export const REQUEST_TIMEOUT_MS = 20_000;
/** Envoi d'un avatar : le fichier est plus lourd et le débit mobile plus incertain. */
export const UPLOAD_TIMEOUT_MS = 60_000;

export class TimeoutError extends Error {
  constructor(message = "Délai dépassé") {
    super(message);
    this.name = "TimeoutError";
  }
}

/**
 * Rejette avec `TimeoutError` si `promise` ne se termine pas en `ms` millisecondes. Accepte les
 * requêtes Supabase (« thenables »). La requête d'origine n'est pas annulée : ses effets, s'il y
 * en a, se produisent quand même (une inscription peut aboutir après le délai).
 */
export function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError()), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}
