import type { ComponentPropsWithoutRef, ReactNode } from "react";

/**
 * Champs de formulaire accessibles : `<label>` relié, description et erreur reliées par
 * `aria-describedby`, erreur annoncée via une zone `aria-live` toujours présente dans le DOM
 * (une zone insérée en même temps que son texte n'est souvent pas annoncée).
 * `id` = `name` : un seul formulaire de chaque champ par page.
 */

const inputClass =
  "block w-full rounded-lg border border-zinc-300 bg-transparent px-3 text-base " +
  "placeholder:text-zinc-500 focus-visible:outline-2 focus-visible:outline-offset-1 " +
  "focus-visible:outline-emerald-700 aria-[invalid=true]:border-red-600 " +
  "dark:border-zinc-700 dark:focus-visible:outline-emerald-400 dark:aria-[invalid=true]:border-red-400";

interface FieldProps {
  name: string;
  label: string;
  hint?: ReactNode;
  error?: string;
}

function FieldShell({
  name,
  label,
  hint,
  error,
  children,
}: FieldProps & { children: (describedBy: string) => ReactNode }) {
  const hintId = `${name}-hint`;
  const errorId = `${name}-error`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="text-sm font-medium">
        {label}
      </label>
      {children(hint ? `${hintId} ${errorId}` : errorId)}
      {hint ? (
        <div id={hintId} aria-live="polite" className="text-sm text-zinc-600 dark:text-zinc-400">
          {hint}
        </div>
      ) : null}
      <p
        id={errorId}
        aria-live="polite"
        className="text-sm font-medium text-red-700 empty:hidden dark:text-red-400"
      >
        {error}
      </p>
    </div>
  );
}

type TextFieldProps = FieldProps & Omit<ComponentPropsWithoutRef<"input">, "id" | "name">;

export function TextField({ name, label, hint, error, className, ...input }: TextFieldProps) {
  return (
    <FieldShell name={name} label={label} hint={hint} error={error}>
      {(describedBy) => (
        <input
          {...input}
          id={name}
          name={name}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`${inputClass} min-h-11 ${className ?? ""}`}
        />
      )}
    </FieldShell>
  );
}

type TextAreaFieldProps = FieldProps & Omit<ComponentPropsWithoutRef<"textarea">, "id" | "name">;

export function TextAreaField({
  name,
  label,
  hint,
  error,
  className,
  ...textarea
}: TextAreaFieldProps) {
  return (
    <FieldShell name={name} label={label} hint={hint} error={error}>
      {(describedBy) => (
        <textarea
          {...textarea}
          id={name}
          name={name}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`${inputClass} py-2 ${className ?? ""}`}
        />
      )}
    </FieldShell>
  );
}

/**
 * Message général d'un formulaire (erreur ou confirmation). Le conteneur `aria-live` est toujours
 * rendu ; le texte, lui, n'apparaît qu'après la soumission.
 */
export function FormMessage({
  message,
  tone = "error",
}: {
  message?: string;
  tone?: "error" | "success" | "info";
}) {
  const color = {
    error:
      "border-red-300 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100",
    success:
      "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100",
    info: "border-zinc-300 bg-zinc-50 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100",
  }[tone];
  return (
    <div aria-live="polite" aria-atomic="true">
      {message ? (
        <p className={`rounded-lg border px-3 py-2 text-sm font-medium ${color}`}>{message}</p>
      ) : null}
    </div>
  );
}
