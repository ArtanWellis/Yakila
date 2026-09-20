import { describe, expect, it, vi } from "vitest";
import { createSupabaseClient } from "./index";
import { avatarObjectPath, updateOwnProfile, uploadAvatar } from "./profiles";

const URL = "https://example.supabase.co";

function fakeJwt(role: string) {
  const encode = (value: object) => btoa(JSON.stringify(value)).replace(/=+$/, "");
  return `${encode({ alg: "HS256" })}.${encode({ role })}.signature`;
}

describe("createSupabaseClient", () => {
  it("accepte une clé publishable", () => {
    expect(() => createSupabaseClient(URL, "sb_publishable_abc123")).not.toThrow();
  });

  it("accepte une clé anon au format JWT", () => {
    expect(() => createSupabaseClient(URL, fakeJwt("anon"))).not.toThrow();
  });

  it("refuse une clé secrète sb_secret_", () => {
    expect(() => createSupabaseClient(URL, "sb_secret_abc123")).toThrow(/service role/i);
  });

  it("refuse un JWT service_role", () => {
    expect(() => createSupabaseClient(URL, fakeJwt("service_role"))).toThrow(/service role/i);
  });
});

describe("avatarObjectPath", () => {
  it("place l'avatar dans le dossier de l'utilisateur", () => {
    expect(avatarObjectPath("1111-2222")).toBe("1111-2222/avatar");
  });
});

describe("updateOwnProfile", () => {
  it("convertit les champs du formulaire en colonnes et cible la ligne de l'utilisateur", () => {
    const single = vi.fn();
    const select = vi.fn(() => ({ single }));
    const eq = vi.fn(() => ({ select }));
    const update = vi.fn(() => ({ eq }));
    const client = { from: vi.fn(() => ({ update })) };

    updateOwnProfile(client as never, "user-1", { displayName: "Marie", bio: null, city: "Évry" });

    expect(client.from).toHaveBeenCalledWith("profiles");
    expect(update).toHaveBeenCalledWith({ display_name: "Marie", bio: null, city: "Évry" });
    expect(eq).toHaveBeenCalledWith("id", "user-1");
  });
});

describe("uploadAvatar", () => {
  it("refuse un type non autorisé sans toucher au réseau", async () => {
    const client = { storage: { from: vi.fn() }, from: vi.fn() };
    const result = await uploadAvatar(
      client as never,
      "user-1",
      new ArrayBuffer(10),
      "image/svg+xml",
    );
    expect(result.data).toBeNull();
    expect(result.error).toBeInstanceOf(Error);
    expect(client.storage.from).not.toHaveBeenCalled();
    expect(client.from).not.toHaveBeenCalled();
  });

  it("refuse un fichier de plus de 2 Mo", async () => {
    const client = { storage: { from: vi.fn() }, from: vi.fn() };
    const tooBig = new ArrayBuffer(2 * 1024 * 1024 + 1);
    const result = await uploadAvatar(client as never, "user-1", tooBig, "image/png");
    expect(result.error).toBeInstanceOf(Error);
    expect(client.storage.from).not.toHaveBeenCalled();
  });

  it("envoie dans {uid}/avatar puis enregistre l'URL publique versionnée", async () => {
    const upload = vi.fn(async () => ({ error: null }));
    const getPublicUrl = vi.fn(() => ({
      data: {
        publicUrl: "https://example.supabase.co/storage/v1/object/public/avatars/user-1/avatar",
      },
    }));
    const eq = vi.fn(async () => ({ error: null }));
    const update = vi.fn(() => ({ eq }));
    const client = {
      storage: { from: vi.fn(() => ({ upload, getPublicUrl })) },
      from: vi.fn(() => ({ update })),
    };

    const result = await uploadAvatar(
      client as never,
      "user-1",
      new ArrayBuffer(1000),
      "image/png",
    );

    expect(client.storage.from).toHaveBeenCalledWith("avatars");
    expect(upload).toHaveBeenCalledWith("user-1/avatar", expect.anything(), {
      contentType: "image/png",
      upsert: true,
    });
    expect(result.error).toBeNull();
    expect(result.data).toMatch(/\/avatars\/user-1\/avatar\?v=\d+$/);
    expect(update).toHaveBeenCalledWith({ avatar_url: result.data });
    expect(eq).toHaveBeenCalledWith("id", "user-1");
  });

  it("ne modifie pas le profil si l'envoi échoue", async () => {
    const upload = vi.fn(async () => ({ error: new Error("boom") }));
    const client = {
      storage: { from: vi.fn(() => ({ upload, getPublicUrl: vi.fn() })) },
      from: vi.fn(),
    };
    const result = await uploadAvatar(client as never, "user-1", new ArrayBuffer(10), "image/png");
    expect(result.data).toBeNull();
    expect(result.error?.message).toBe("boom");
    expect(client.from).not.toHaveBeenCalled();
  });
});
