import { describe, expect, it, vi } from "vitest";
import { AVATAR_BUCKET, AVATAR_MAX_BYTES, AVATAR_MIME_TYPES } from "@yakila/types";
import { USERNAME_PATTERN, coordinatesSchema, updateProfileSchema } from "@yakila/validation";
import databaseTypes from "../../types/src/database.ts?raw";
import { createSupabaseClient } from "./index";
import { avatarObjectPath, setProfileLocation, updateOwnProfile, uploadAvatar } from "./profiles";

/**
 * Tests de contrat : aucune base n'est disponible pour exécuter les migrations (projet Supabase cloud,
 * pas de Docker), donc on lit le SQL comme du texte et on vérifie qu'il dit la même chose que
 * `@yakila/types`, `@yakila/validation` et `@yakila/api`. Ils ne remplacent pas les tests RLS réels
 * (supabase/tests/manual/phase1-rls-checks.sql) : ils attrapent la dérive entre les couches.
 */

const migrationFiles = import.meta.glob("../../../supabase/migrations/*.sql", {
  query: "?raw",
  import: "default",
  eager: true,
});

/** Toutes les migrations dans l'ordre, sans les commentaires (`-- ...`). */
const sql = Object.entries(migrationFiles)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([, content]) => content.replace(/--.*$/gm, ""))
  .join("\n");

function group(match: RegExpExecArray | null, index: number): string {
  const value = match?.[index];
  if (value === undefined) throw new Error("Motif introuvable dans les migrations SQL");
  return value;
}

interface Column {
  nullable: boolean;
  type: "string" | "number";
}

const SQL_TYPES = {
  uuid: "string",
  text: "string",
  timestamptz: "string",
  "double precision": "number",
} as const;

function sqlColumns(table: string): Map<string, Column> {
  const start = sql.indexOf(`create table public.${table} (`);
  if (start === -1) throw new Error(`Table ${table} introuvable dans les migrations`);
  const body = sql.slice(start, sql.indexOf("\n);", start));
  const columns = new Map<string, Column>();
  for (const line of body.split("\n")) {
    const match = /^\s{2}([a-z_]+)\s+(uuid|text|double precision|timestamptz)\b(.*)$/.exec(line);
    if (match) {
      const type = SQL_TYPES[group(match, 2) as keyof typeof SQL_TYPES];
      columns.set(group(match, 1), { nullable: !/not null/.test(group(match, 3)), type });
    }
  }
  return columns;
}

/**
 * Colonnes du type `Row` d'une table dans `database.ts`. Tolère la sortie du générateur Supabase
 * (sans point-virgule) comme la version écrite à la main (avec) : le fichier sera remplacé.
 */
function tsRowColumns(table: string): Map<string, Column> {
  const header = new RegExp(`\\b${table}: \\{\\s*Row: \\{`).exec(databaseTypes);
  if (header === null) throw new Error(`Type Row de ${table} introuvable dans database.ts`);
  const open = header.index + header[0].length - 1;
  let depth = 0;
  let close = open;
  for (let index = open; index < databaseTypes.length; index++) {
    if (databaseTypes[index] === "{") depth++;
    if (databaseTypes[index] === "}" && --depth === 0) {
      close = index;
      break;
    }
  }
  const block = databaseTypes.slice(open + 1, close);
  const columns = new Map<string, Column>();
  for (const match of block.matchAll(/^\s*([a-z_]+): ([^;\n]+);?\s*$/gm)) {
    const type = group(match, 2).replace("| null", "").trim();
    columns.set(group(match, 1), {
      nullable: group(match, 2).includes("| null"),
      type: type === "number" ? "number" : "string",
    });
  }
  return columns;
}

function sortedEntries(columns: Map<string, Column>) {
  return [...columns.entries()].sort(([a], [b]) => a.localeCompare(b));
}

describe("contrat : les migrations lisibles", () => {
  it("trouve les 7 migrations de la phase 1", () => {
    expect(Object.keys(migrationFiles).length).toBeGreaterThanOrEqual(7);
    expect(sql).toContain("create table public.profiles");
    expect(sql).toContain("create table public.profile_private");
  });
});

describe("contrat : database.ts reflète les tables SQL", () => {
  for (const table of ["profiles", "profile_private"]) {
    it(`${table} : mêmes colonnes, types et nullabilité`, () => {
      expect(sortedEntries(tsRowColumns(table))).toEqual(sortedEntries(sqlColumns(table)));
    });
  }

  it("aucune colonne de position exacte dans la table publique profiles", () => {
    for (const name of sqlColumns("profiles").keys()) expect(name).not.toMatch(/^exact_/);
    for (const name of tsRowColumns("profiles").keys()) expect(name).not.toMatch(/^exact_/);
  });

  it("les RPC de position ont les mêmes noms et paramètres en SQL et en TypeScript", () => {
    const setSql = /function public\.set_profile_location\(([^)]*)\)\s*returns void/.exec(sql);
    const sqlParams = group(setSql, 1)
      .split(",")
      .map((param) => param.trim().split(/\s+/)[0]);
    expect(sqlParams).toEqual(["p_lat", "p_lng"]);
    // Souple sur la mise en forme : le générateur de types remplacera ce fichier écrit à la main
    // (`Args: never` ou `Record<PropertyKey, never>` selon la version pour une fonction sans argument).
    expect(databaseTypes).toMatch(
      /set_profile_location: \{\s*Args: \{\s*p_lat: number;?\s*p_lng: number;?\s*\}/,
    );
    expect(sql).toMatch(/function public\.clear_profile_location\(\)\s*returns void/);
    expect(databaseTypes).toMatch(
      /clear_profile_location: \{\s*Args: (never|Record<PropertyKey, never>)/,
    );
  });

  it("setProfileLocation appelle la RPC avec les paramètres p_lat / p_lng", async () => {
    const rpc = vi.fn(async () => ({ data: null, error: null }));
    await setProfileLocation({ rpc } as never, { lat: 48.85661, lng: 2.35222 });
    expect(rpc).toHaveBeenCalledWith("set_profile_location", { p_lat: 48.85661, p_lng: 2.35222 });
  });
});

describe("contrat : SQL et schémas de validation", () => {
  it("le pseudo suit la même expression régulière dans la contrainte, le trigger et Zod", () => {
    expect(sql).toContain(`username ~ '${USERNAME_PATTERN.source}'`);
    expect(sql).toContain(`v_username !~ '${USERNAME_PATTERN.source}'`);
  });

  it("les longueurs maximales de display_name, bio et city sont les mêmes qu'en Zod", () => {
    const fields = [
      ["display_name", "displayName"],
      ["bio", "bio"],
      ["city", "city"],
    ] as const;
    for (const [column, field] of fields) {
      const match = new RegExp(`char_length\\(${column}\\) between (\\d+) and (\\d+)`).exec(sql);
      const [min, max] = [Number(group(match, 1)), Number(group(match, 2))];
      // Minimum 1 : la base refuse la chaîne vide, les clients envoient `null` à la place.
      expect(min).toBe(1);
      const input = (value: string) => ({ displayName: "x", bio: "x", city: "x", [field]: value });
      expect(updateProfileSchema.safeParse(input("a".repeat(max))).success).toBe(true);
      expect(updateProfileSchema.safeParse(input("a".repeat(max + 1))).success).toBe(false);
    }
  });

  it("les bornes de latitude et de longitude sont les mêmes dans la RPC, les contraintes et Zod", () => {
    const lat = /p_lat not between (-?\d+) and (-?\d+)/.exec(sql);
    const lng = /p_lng not between (-?\d+) and (-?\d+)/.exec(sql);
    const [latMin, latMax] = [Number(group(lat, 1)), Number(group(lat, 2))];
    const [lngMin, lngMax] = [Number(group(lng, 1)), Number(group(lng, 2))];
    expect(sql).toContain(`approx_lat between ${latMin} and ${latMax}`);
    expect(sql).toContain(`exact_lat between ${latMin} and ${latMax}`);
    expect(sql).toContain(`approx_lng between ${lngMin} and ${lngMax}`);
    expect(sql).toContain(`exact_lng between ${lngMin} and ${lngMax}`);

    const ok = (lat: number, lng: number) => coordinatesSchema.safeParse({ lat, lng }).success;
    expect(ok(latMin, lngMin)).toBe(true);
    expect(ok(latMax, lngMax)).toBe(true);
    expect(ok(latMax + 0.0001, 0)).toBe(false);
    expect(ok(0, lngMin - 0.0001)).toBe(false);
  });

  it("la position publique est arrondie à 2 décimales côté base", () => {
    expect(sql).toContain("round(p_lat::numeric, 2)");
    expect(sql).toContain("round(p_lng::numeric, 2)");
  });
});

describe("contrat : bucket avatars", () => {
  const bucket =
    /insert into storage\.buckets \([^)]*\)\s*values \('([^']+)', '([^']+)', (true|false), (\d+), array\[([^\]]+)\]\)/.exec(
      sql,
    );

  it("l'identifiant, la visibilité, la taille et les types MIME sont ceux de @yakila/types", () => {
    expect(group(bucket, 1)).toBe(AVATAR_BUCKET);
    expect(group(bucket, 3)).toBe("true");
    expect(Number(group(bucket, 4))).toBe(AVATAR_MAX_BYTES);
    const mimeTypes = group(bucket, 5)
      .split(",")
      .map((item) => item.trim().replace(/'/g, ""));
    expect([...mimeTypes].sort()).toEqual([...AVATAR_MIME_TYPES].sort());
  });

  it("les policies Storage n'autorisent que le chemin {uid}/avatar de avatarObjectPath", () => {
    expect(sql).toContain("name = ((select auth.uid())::text || '/avatar')");
    expect(avatarObjectPath("abc")).toBe("abc/avatar");
  });
});

describe("contrat : ce que le client envoie à la base", () => {
  const grant = /grant update \(([^)]+)\) on table public\.profiles to authenticated/.exec(sql);
  const grantedColumns = group(grant, 1)
    .split(",")
    .map((column) => column.trim());

  it("updateOwnProfile n'écrit que des colonnes dont authenticated a le droit de modification", () => {
    const single = vi.fn(async () => ({ data: null, error: null }));
    const eq = vi.fn(() => ({ select: () => ({ single }) }));
    const update = vi.fn(() => ({ eq }));
    updateOwnProfile({ from: () => ({ update }) } as never, "u1", {
      displayName: "M",
      bio: null,
      city: null,
    });
    const sent = Object.keys((update.mock.calls[0] as unknown[])[0] as object);
    expect(sent.length).toBeGreaterThan(0);
    for (const column of sent) expect(grantedColumns).toContain(column);
  });

  /** Client factice : `getPublicUrl` est le vrai (aucun réseau), le reste est simulé. */
  function uploadingClient(projectUrl: string) {
    const realBucket = createSupabaseClient(projectUrl, "sb_publishable_test").storage.from(
      AVATAR_BUCKET,
    );
    const sent: Record<string, unknown>[] = [];
    const client = {
      storage: {
        from: () => ({
          upload: async () => ({ error: null }),
          getPublicUrl: (path: string) => realBucket.getPublicUrl(path),
        }),
      },
      from: () => ({
        update: (payload: Record<string, unknown>) => {
          sent.push(payload);
          return { eq: async () => ({ error: null }) };
        },
      }),
    };
    return { client, sent };
  }

  /** L'expression régulière de la contrainte `profiles_avatar_url_format`, convertie pour JavaScript. */
  function avatarUrlPattern(userId: string): RegExp {
    const match = /'(\^https\?:[^']*)'\s*\|\|\s*id::text\s*\|\|\s*'([^']*)'/.exec(sql);
    const posix = group(match, 1) + userId + group(match, 2);
    return new RegExp(posix.replace("[:space:]", "\\s"));
  }

  it("uploadAvatar n'écrit que avatar_url, une colonne autorisée", async () => {
    const { client, sent } = uploadingClient("https://abcdefgh.supabase.co");
    await uploadAvatar(client as never, "u1", new ArrayBuffer(10), "image/png");
    expect(Object.keys(sent[0] ?? {})).toEqual(["avatar_url"]);
    expect(grantedColumns).toContain("avatar_url");
  });

  for (const projectUrl of ["https://abcdefgh.supabase.co", "http://localhost:54321"]) {
    it(`l'URL produite par uploadAvatar (${projectUrl}) respecte la contrainte profiles_avatar_url_format`, async () => {
      const userId = "11111111-1111-4111-8111-111111111111";
      const { client } = uploadingClient(projectUrl);
      const { data, error } = await uploadAvatar(
        client as never,
        userId,
        new ArrayBuffer(10),
        "image/png",
      );
      expect(error).toBeNull();
      const pattern = avatarUrlPattern(userId);
      expect(data).toMatch(pattern);
      // Sans `?v=`, avec un `?v=` invalide, ou avec l'identifiant d'un autre utilisateur : refusés.
      const base = String(data).split("?")[0];
      expect(base).toMatch(pattern);
      expect(`${base}?v=abc`).not.toMatch(pattern);
      expect(`${base}?v=1&x=2`).not.toMatch(pattern);
      expect(String(data).replace(userId, "22222222-2222-4222-8222-222222222222")).not.toMatch(
        pattern,
      );
    });
  }
});

describe("contrat : hygiène des migrations (remplace des tests RLS automatisés)", () => {
  const tables = [...sql.matchAll(/create table (?:if not exists )?public\.(\w+)/g)].map((m) =>
    group(m, 1),
  );

  it("chaque table de public active la RLS", () => {
    expect(tables.length).toBeGreaterThan(0);
    for (const table of tables) {
      expect(sql, `RLS manquante sur public.${table}`).toMatch(
        new RegExp(`alter table public\\.${table} enable row level security`),
      );
    }
  });

  it("anon n'a aucun droit d'écriture accordé sur les tables", () => {
    expect(sql).not.toMatch(/grant\s+(all|insert|update|delete|truncate)[^;]*\bto\b[^;]*\banon\b/i);
  });

  it("profile_private : lecture seule pour authenticated, aucune policy d'écriture", () => {
    expect(sql).toMatch(/grant select on table public\.profile_private to authenticated\s*;/);
    expect(sql).not.toMatch(/grant\s+(all|insert|update|delete)[^;]*public\.profile_private/i);
    expect(sql).not.toMatch(
      /create policy \w+\s+on public\.profile_private\s+for\s+(insert|update|delete|all)/i,
    );
  });

  it("profiles : aucune policy d'insertion ni de suppression, update limité aux colonnes autorisées", () => {
    expect(sql).not.toMatch(/create policy \w+\s+on public\.profiles\s+for\s+(insert|delete|all)/i);
    expect(sql).not.toMatch(/grant\s+update\s+on table public\.profiles/i);
  });

  it("toute fonction security definer fixe search_path à vide", () => {
    const definitions = sql.split(/create (?:or replace )?function /i).slice(1);
    const definers = definitions.filter((definition) =>
      /security definer/i.test(definition.split(/\bas\s+\$/i)[0] ?? ""),
    );
    expect(definers.length).toBeGreaterThan(0);
    for (const definition of definers) {
      const header = definition.split(/\bas\s+\$/i)[0] ?? "";
      expect(header, `search_path manquant : ${header.slice(0, 60)}`).toMatch(
        /set search_path = ''/i,
      );
    }
  });

  it("les fonctions security definer accessibles par l'API n'ont pas execute pour anon", () => {
    expect(sql).toMatch(
      /revoke all on function public\.set_profile_location\(double precision, double precision\) from public, anon/,
    );
    expect(sql).toMatch(
      /revoke all on function public\.clear_profile_location\(\) from public, anon/,
    );
    expect(sql).not.toMatch(/grant execute on function[^;]*\bto\b[^;]*\banon\b/i);
  });
});
