import { describe, expect, it } from "vitest";
import { isServiceRoleKey } from "./keys";
import { isTrustedAvatarUrl } from "./profiles";

const SUPABASE = "https://abcd1234.supabase.co";
const UID = "11111111-2222-3333-4444-555555555555";
const OWN = `${SUPABASE}/storage/v1/object/public/avatars/${UID}/avatar`;

describe("isTrustedAvatarUrl", () => {
  it("accepte l'avatar du bucket de notre projet, avec ou sans ?v=", () => {
    expect(isTrustedAvatarUrl(OWN, SUPABASE)).toBe(true);
    expect(isTrustedAvatarUrl(`${OWN}?v=1789926089875`, SUPABASE)).toBe(true);
  });

  it("accepte l'URL du projet écrite avec un slash final", () => {
    expect(isTrustedAvatarUrl(OWN, `${SUPABASE}/`)).toBe(true);
  });

  it("refuse un hôte externe au bon format de chemin (le cas que la base ne peut pas bloquer)", () => {
    const external = `https://attaquant.example/storage/v1/object/public/avatars/${UID}/avatar`;
    expect(isTrustedAvatarUrl(external, SUPABASE)).toBe(false);
  });

  it("refuse un hôte qui commence ou finit comme le nôtre", () => {
    const suffix = `https://abcd1234.supabase.co.attaquant.example/storage/v1/object/public/avatars/${UID}/avatar`;
    const userinfo = `https://abcd1234.supabase.co@attaquant.example/storage/v1/object/public/avatars/${UID}/avatar`;
    expect(isTrustedAvatarUrl(suffix, SUPABASE)).toBe(false);
    expect(isTrustedAvatarUrl(userinfo, SUPABASE)).toBe(false);
  });

  it("refuse les identifiants dans l'URL, même quand WHATWG y lit notre hôte", () => {
    const path = `/storage/v1/object/public/avatars/${UID}/avatar`;
    // Pour WHATWG l'hôte est bien le nôtre (le dernier `@` sépare les identifiants) ; un analyseur natif
    // qui coupe au premier `@` joindrait evil.example.
    const ambiguous = `https://x@evil.example@abcd1234.supabase.co${path}`;
    const withPassword = `https://user:pass@abcd1234.supabase.co${path}`;
    expect(new URL(ambiguous).origin).toBe(SUPABASE);
    expect(isTrustedAvatarUrl(ambiguous, SUPABASE)).toBe(false);
    expect(isTrustedAvatarUrl(withPassword, SUPABASE)).toBe(false);
  });

  it("refuse une URL précédée d'espaces ou écrite en majuscules (jamais produite par getPublicUrl)", () => {
    expect(isTrustedAvatarUrl(` ${OWN}`, SUPABASE)).toBe(false);
    expect(
      isTrustedAvatarUrl(OWN.replace("abcd1234.supabase.co", "ABCD1234.SUPABASE.CO"), SUPABASE),
    ).toBe(false);
  });

  it("refuse http quand le projet est en https", () => {
    expect(isTrustedAvatarUrl(OWN.replace("https:", "http:"), SUPABASE)).toBe(false);
  });

  it("refuse un autre bucket, y compris par remontée de dossier", () => {
    const other = `${SUPABASE}/storage/v1/object/public/documents/${UID}/avatar`;
    const dotdot = `${SUPABASE}/storage/v1/object/public/avatars/../documents/secret.png`;
    const encoded = `${SUPABASE}/storage/v1/object/public/avatars/%2e%2e/documents/secret.png`;
    expect(isTrustedAvatarUrl(other, SUPABASE)).toBe(false);
    expect(isTrustedAvatarUrl(dotdot, SUPABASE)).toBe(false);
    expect(isTrustedAvatarUrl(encoded, SUPABASE)).toBe(false);
  });

  it("refuse tout quand l'URL du projet est absente ou invalide", () => {
    expect(isTrustedAvatarUrl(OWN, undefined)).toBe(false);
    expect(isTrustedAvatarUrl(OWN, null)).toBe(false);
    expect(isTrustedAvatarUrl(OWN, "")).toBe(false);
    expect(isTrustedAvatarUrl(OWN, "pas une url")).toBe(false);
  });

  it("refuse une valeur qui n'est pas une URL", () => {
    expect(isTrustedAvatarUrl("", SUPABASE)).toBe(false);
    expect(isTrustedAvatarUrl("javascript:alert(1)", SUPABASE)).toBe(false);
    expect(isTrustedAvatarUrl("/storage/v1/object/public/avatars/x/avatar", SUPABASE)).toBe(false);
  });
});

describe("isServiceRoleKey", () => {
  const encode = (value: object) => btoa(JSON.stringify(value)).replace(/=+$/, "");
  const jwt = (role: string) => `${encode({ alg: "HS256" })}.${encode({ role })}.signature`;

  it("détecte les clés secrètes et les JWT service_role", () => {
    expect(isServiceRoleKey("sb_secret_abc123")).toBe(true);
    expect(isServiceRoleKey(jwt("service_role"))).toBe(true);
  });

  it("laisse passer les clés publiques", () => {
    expect(isServiceRoleKey("sb_publishable_abc123")).toBe(false);
    expect(isServiceRoleKey(jwt("anon"))).toBe(false);
  });

  it("ne plante pas sur une valeur qui ne ressemble pas à une clé", () => {
    expect(isServiceRoleKey("")).toBe(false);
    expect(isServiceRoleKey("a.b.c")).toBe(false);
    expect(isServiceRoleKey("a.%%%.c")).toBe(false);
  });
});
