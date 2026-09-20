/**
 * État renvoyé par une Server Action de formulaire (`useActionState`).
 * `values` ré-affiche ce que l'utilisateur a saisi (jamais le mot de passe) après une erreur.
 */
export interface FormState<Field extends string> {
  status?: "saved" | "error";
  /** Message général, lu par les lecteurs d'écran via une zone `aria-live`. */
  message?: string;
  errors?: Partial<Record<Field, string>>;
  values?: Partial<Record<Field, string>>;
}

/** Lit un champ texte ; tout ce qui n'est pas une chaîne (fichier, champ absent) devient `""`. */
export function formString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

interface IssueLike {
  path: readonly PropertyKey[];
  message: string;
}

/** Première erreur de validation par champ, à partir des `issues` d'un `safeParse` Zod. */
export function fieldErrors<Field extends string>(
  issues: readonly IssueLike[],
  fields: readonly Field[],
): Partial<Record<Field, string>> {
  const errors: Partial<Record<Field, string>> = {};
  for (const issue of issues) {
    const field = fields.find((candidate) => candidate === issue.path[0]);
    if (field && errors[field] === undefined) errors[field] = issue.message;
  }
  return errors;
}
