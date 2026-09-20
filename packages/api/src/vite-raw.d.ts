// Types minimaux pour les imports `?raw` de Vite / Vitest : les tests de contrat
// (contract.test.ts) lisent les migrations SQL et `database.ts` comme du texte.
declare module "*?raw" {
  const content: string;
  export default content;
}

interface ImportMeta {
  glob(
    pattern: string,
    options: { query: "?raw"; import: "default"; eager: true },
  ): Record<string, string>;
}
