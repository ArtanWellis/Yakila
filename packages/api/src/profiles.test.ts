import { describe, expect, it, vi } from "vitest";
import { createSupabaseClient } from "./index";
import {
  clearProfileLocation,
  fetchProfile,
  fetchProfileByUsername,
  isUsernameAvailable,
  setProfileLocation,
  uploadAvatar,
} from "./profiles";

describe("fetchProfile / fetchProfileByUsername", () => {
  it("lit une seule ligne, par id", () => {
    const maybeSingle = vi.fn();
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    const client = { from: vi.fn(() => ({ select })) };

    fetchProfile(client as never, "user-1");

    expect(client.from).toHaveBeenCalledWith("profiles");
    expect(eq).toHaveBeenCalledWith("id", "user-1");
    expect(maybeSingle).toHaveBeenCalledTimes(1);
  });

  it("lit une seule ligne, par pseudo (maybeSingle : un pseudo inconnu n'est pas une erreur)", () => {
    const maybeSingle = vi.fn();
    const eq = vi.fn(() => ({ maybeSingle }));
    const client = { from: vi.fn(() => ({ select: vi.fn(() => ({ eq })) })) };

    fetchProfileByUsername(client as never, "marie_d");

    expect(eq).toHaveBeenCalledWith("username", "marie_d");
    expect(maybeSingle).toHaveBeenCalledTimes(1);
  });
});

describe("isUsernameAvailable", () => {
  function clientReturning(response: { count: number | null; error: unknown }) {
    const eq = vi.fn(async () => response);
    const select = vi.fn(() => ({ eq }));
    return { client: { from: vi.fn(() => ({ select })) }, select, eq };
  }

  it("est vrai quand aucun profil n'a ce pseudo", async () => {
    const { client, select, eq } = clientReturning({ count: 0, error: null });
    const result = await isUsernameAvailable(client as never, "libre");
    expect(result).toEqual({ data: true, error: null });
    // Un simple comptage (HEAD) : aucune ligne de profil n'est rapatriée.
    expect(select).toHaveBeenCalledWith("id", { count: "exact", head: true });
    expect(eq).toHaveBeenCalledWith("username", "libre");
  });

  it("est faux quand le pseudo existe", async () => {
    const { client } = clientReturning({ count: 1, error: null });
    expect((await isUsernameAvailable(client as never, "pris")).data).toBe(false);
  });

  it("est inconnu (null) en cas d'erreur : on ne bloque pas l'inscription sur une panne", async () => {
    const error = { message: "network", code: "" };
    const { client } = clientReturning({ count: null, error });
    expect(await isUsernameAvailable(client as never, "x")).toEqual({ data: null, error });
  });

  it("est inconnu (null) quand la réponse ne contient pas de total : jamais « pris » à tort", async () => {
    const { client } = clientReturning({ count: null, error: null });
    expect((await isUsernameAvailable(client as never, "x")).data).toBeNull();
  });
});

describe("setProfileLocation / clearProfileLocation", () => {
  it("passe les coordonnées à la RPC, sous les noms de paramètres SQL p_lat / p_lng", async () => {
    const rpc = vi.fn(async () => ({ data: null, error: null }));
    await setProfileLocation({ rpc } as never, { lat: 48.85661, lng: 2.35222 });
    expect(rpc).toHaveBeenCalledWith("set_profile_location", { p_lat: 48.85661, p_lng: 2.35222 });
  });

  it("appelle clear_profile_location sans argument", async () => {
    const rpc = vi.fn(async () => ({ data: null, error: null }));
    await clearProfileLocation({ rpc } as never);
    expect(rpc).toHaveBeenCalledWith("clear_profile_location");
  });

  it("remonte l'erreur de la base telle quelle (l'appelant décide du message)", async () => {
    const error = { code: "22023", message: "invalid_coordinates" };
    const rpc = vi.fn(async () => ({ data: null, error }));
    const result = await setProfileLocation({ rpc } as never, { lat: 0, lng: 0 });
    expect(result.error).toBe(error);
  });
});

describe("uploadAvatar : cas limites", () => {
  const publicUrl = "https://example.supabase.co/storage/v1/object/public/avatars/user-1/avatar";

  function clientWith(options: {
    uploadError?: Error | null;
    updateError?: { code: string; message: string } | null;
  }) {
    const upload = vi.fn(async () => ({ error: options.uploadError ?? null }));
    const getPublicUrl = vi.fn(() => ({ data: { publicUrl } }));
    const eq = vi.fn(async () => ({ error: options.updateError ?? null }));
    const update = vi.fn(() => ({ eq }));
    const client = {
      storage: { from: vi.fn(() => ({ upload, getPublicUrl })) },
      from: vi.fn(() => ({ update })),
    };
    return { client, upload, update };
  }

  it("accepte exactement 2 Mo, en Blob comme en ArrayBuffer", async () => {
    const limit = 2 * 1024 * 1024;
    for (const body of [new Blob([new Uint8Array(limit)]), new ArrayBuffer(limit)]) {
      const { client, upload } = clientWith({});
      const result = await uploadAvatar(client as never, "user-1", body, "image/webp");
      expect(result.error).toBeNull();
      expect(upload).toHaveBeenCalledTimes(1);
    }
  });

  it("refuse 2 Mo + 1 octet, en Blob comme en ArrayBuffer, sans rien envoyer", async () => {
    const tooBig = 2 * 1024 * 1024 + 1;
    for (const body of [new Blob([new Uint8Array(tooBig)]), new ArrayBuffer(tooBig)]) {
      const { client, upload } = clientWith({});
      const result = await uploadAvatar(client as never, "user-1", body, "image/png");
      expect(result.data).toBeNull();
      expect(result.error?.message).toBe("2 Mo maximum");
      expect(upload).not.toHaveBeenCalled();
    }
  });

  it("refuse un fichier vide avec un message en français", async () => {
    const { client, upload } = clientWith({});
    const result = await uploadAvatar(client as never, "user-1", new ArrayBuffer(0), "image/png");
    expect(result.data).toBeNull();
    expect(result.error?.message).toBe("Le fichier est vide");
    expect(upload).not.toHaveBeenCalled();
  });

  it("refuse les types hors liste, y compris image/jpg et les majuscules (à normaliser avant l'appel)", async () => {
    for (const type of ["image/jpg", "IMAGE/PNG", "image/heic", "image/gif", "text/html", ""]) {
      const { client, upload } = clientWith({});
      const result = await uploadAvatar(client as never, "user-1", new ArrayBuffer(10), type);
      expect(result.data, type).toBeNull();
      expect(result.error?.message, type).toBe("Formats acceptés : JPEG, PNG, WebP");
      expect(upload).not.toHaveBeenCalled();
    }
  });

  it("l'envoi réussit mais l'enregistrement de l'URL échoue : erreur, pas d'URL retournée", async () => {
    const updateError = { code: "23514", message: "violates check constraint" };
    const { client, upload, update } = clientWith({ updateError });
    const result = await uploadAvatar(client as never, "user-1", new ArrayBuffer(10), "image/png");
    expect(upload).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledTimes(1);
    expect(result.data).toBeNull();
    expect(result.error).toBe(updateError);
  });

  it("une URL différente à chaque envoi rapproché (?v= change avec l'horloge)", async () => {
    vi.useFakeTimers();
    try {
      const { client } = clientWith({});
      vi.setSystemTime(1_700_000_000_000);
      const first = await uploadAvatar(client as never, "user-1", new ArrayBuffer(10), "image/png");
      vi.setSystemTime(1_700_000_000_001);
      const second = await uploadAvatar(
        client as never,
        "user-1",
        new ArrayBuffer(10),
        "image/png",
      );
      expect(first.data).toBe(`${publicUrl}?v=1700000000000`);
      expect(second.data).toBe(`${publicUrl}?v=1700000000001`);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("createSupabaseClient : clés étranges", () => {
  const URL = "https://example.supabase.co";
  const base64url = (value: string) =>
    btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  it("refuse un JWT service_role dont le contenu utilise l'alphabet base64url (- et _)", () => {
    // Les caractères « ?? » donnent un « / » en base64, donc un « _ » en base64url.
    const payload = base64url(JSON.stringify({ role: "service_role", note: "???>>>" }));
    expect(payload).toMatch(/[-_]/);
    expect(() => createSupabaseClient(URL, `${base64url("{}")}.${payload}.sig`)).toThrow(
      /service role/i,
    );
  });

  it("ne plante pas sur une clé qui n'est pas un JWT (le contrôle ne doit pas casser les clés valides)", () => {
    for (const key of ["sb_publishable_x", "abc", "a.b", "a.%%%.c", "a..c"]) {
      expect(() => createSupabaseClient(URL, key), key).not.toThrow();
    }
  });

  it("refuse toute clé qui commence par sb_secret_, même tronquée", () => {
    expect(() => createSupabaseClient(URL, "sb_secret_")).toThrow(/service role/i);
  });
});
