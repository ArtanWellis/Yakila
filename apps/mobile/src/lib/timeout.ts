export class TimeoutError extends Error {
  constructor(message = "Délai dépassé") {
    super(message);
    this.name = "TimeoutError";
  }
}

/**
 * Rejette avec `TimeoutError` si `promise` ne se termine pas en `ms` millisecondes. La promesse
 * d'origine n'est pas annulée (ses effets, s'il y en a, se produisent quand même).
 */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
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
