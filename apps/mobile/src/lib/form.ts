/** Forme minimale d'un problème de validation Zod (`ZodIssue`), sans importer zod. */
export interface IssueLike {
  path: readonly PropertyKey[];
  message: string;
}

export type FieldErrors<Field extends string> = Partial<Record<Field, string>>;

/**
 * Regroupe les problèmes d'un schéma Zod par champ : le premier message de chaque champ est conservé.
 * Les problèmes qui ne concernent aucun champ connu sont ignorés.
 */
export function fieldErrorsFromIssues<Field extends string>(
  issues: readonly IssueLike[],
  fields: readonly Field[],
): FieldErrors<Field> {
  const errors: FieldErrors<Field> = {};
  for (const issue of issues) {
    const field = fields.find((candidate) => candidate === issue.path[0]);
    if (field !== undefined && errors[field] === undefined) errors[field] = issue.message;
  }
  return errors;
}
