import { describe, expect, it } from "vitest";
import {
  avatarFileSchema,
  coordinatesSchema,
  emailSchema,
  passwordSchema,
  searchRadiusSchema,
  signInSchema,
  signUpSchema,
  updateProfileSchema,
  usernameSchema,
} from "./index";

describe("searchRadiusSchema", () => {
  it("accepte les rayons proposés", () => {
    for (const km of [2, 5, 10, 25, 50]) {
      expect(searchRadiusSchema.safeParse(km).success).toBe(true);
    }
  });

  it("refuse les autres valeurs", () => {
    expect(searchRadiusSchema.safeParse(3).success).toBe(false);
    expect(searchRadiusSchema.safeParse(0).success).toBe(false);
  });
});

describe("coordinatesSchema", () => {
  it("refuse une latitude hors limites", () => {
    expect(coordinatesSchema.safeParse({ lat: 91, lng: 0 }).success).toBe(false);
  });

  it("refuse une longitude hors limites", () => {
    expect(coordinatesSchema.safeParse({ lat: 0, lng: -181 }).success).toBe(false);
  });

  it("accepte Évry", () => {
    expect(coordinatesSchema.safeParse({ lat: 48.6237, lng: 2.4297 }).success).toBe(true);
  });
});

describe("usernameSchema", () => {
  it("accepte un pseudo valide", () => {
    expect(usernameSchema.parse("marie_92")).toBe("marie_92");
  });

  it("normalise : espaces retirés, minuscules", () => {
    expect(usernameSchema.parse("  Marie_92 ")).toBe("marie_92");
  });

  it("accepte les longueurs limites 3 et 30", () => {
    expect(usernameSchema.safeParse("abc").success).toBe(true);
    expect(usernameSchema.safeParse("a".repeat(30)).success).toBe(true);
  });

  it("refuse trop court ou trop long", () => {
    expect(usernameSchema.safeParse("ab").success).toBe(false);
    expect(usernameSchema.safeParse("a".repeat(31)).success).toBe(false);
  });

  it("refuse les caractères hors [a-z0-9_]", () => {
    for (const bad of ["marie-92", "marie.92", "marie 92", "marié", "marie@92", "", "💡💡💡"]) {
      expect(usernameSchema.safeParse(bad).success).toBe(false);
    }
  });
});

describe("emailSchema", () => {
  it("normalise en minuscules sans espaces", () => {
    expect(emailSchema.parse("  Marie@Exemple.FR ")).toBe("marie@exemple.fr");
  });

  it("refuse une adresse invalide", () => {
    expect(emailSchema.safeParse("pas-un-email").success).toBe(false);
    expect(emailSchema.safeParse("").success).toBe(false);
  });
});

describe("passwordSchema", () => {
  it("accepte 8 caractères", () => {
    expect(passwordSchema.safeParse("12345678").success).toBe(true);
  });

  it("refuse 7 caractères", () => {
    expect(passwordSchema.safeParse("1234567").success).toBe(false);
  });

  it("refuse plus de 72 caractères (limite bcrypt)", () => {
    expect(passwordSchema.safeParse("a".repeat(72)).success).toBe(true);
    expect(passwordSchema.safeParse("a".repeat(73)).success).toBe(false);
  });

  it("ne modifie pas le mot de passe (pas de trim)", () => {
    expect(passwordSchema.parse("  espaces  ")).toBe("  espaces  ");
  });
});

describe("signUpSchema", () => {
  it("normalise et accepte une inscription valide", () => {
    const result = signUpSchema.parse({
      email: " Marie@Exemple.fr",
      password: "motdepasse",
      username: "Marie_92",
    });
    expect(result).toEqual({
      email: "marie@exemple.fr",
      password: "motdepasse",
      username: "marie_92",
    });
  });

  it("refuse si le pseudo manque", () => {
    expect(signUpSchema.safeParse({ email: "a@b.fr", password: "motdepasse" }).success).toBe(false);
  });

  it("signale chaque champ invalide", () => {
    const result = signUpSchema.safeParse({ email: "x", password: "1", username: "!" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.issues.map((issue) => issue.path[0]);
      expect(fields).toEqual(expect.arrayContaining(["email", "password", "username"]));
    }
  });
});

describe("signInSchema", () => {
  it("accepte un mot de passe court (ancien compte)", () => {
    expect(signInSchema.safeParse({ email: "a@b.fr", password: "x" }).success).toBe(true);
  });

  it("refuse un mot de passe vide", () => {
    expect(signInSchema.safeParse({ email: "a@b.fr", password: "" }).success).toBe(false);
  });
});

describe("updateProfileSchema", () => {
  it("transforme les chaînes vides en null", () => {
    expect(updateProfileSchema.parse({ displayName: "  ", bio: "", city: "" })).toEqual({
      displayName: null,
      bio: null,
      city: null,
    });
  });

  it("garde les valeurs renseignées, espaces retirés", () => {
    expect(
      updateProfileSchema.parse({ displayName: " Marie ", bio: "Jardinage", city: " Évry " }),
    ).toEqual({ displayName: "Marie", bio: "Jardinage", city: "Évry" });
  });

  it("refuse une bio de plus de 500 caractères, accepte 500", () => {
    const base = { displayName: "M", city: "Évry" };
    expect(updateProfileSchema.safeParse({ ...base, bio: "a".repeat(500) }).success).toBe(true);
    expect(updateProfileSchema.safeParse({ ...base, bio: "a".repeat(501) }).success).toBe(false);
  });

  it("refuse un nom affiché de plus de 50 caractères", () => {
    expect(
      updateProfileSchema.safeParse({ displayName: "a".repeat(51), bio: "", city: "" }).success,
    ).toBe(false);
  });

  it("ignore les champs hors périmètre (username, avatar_url)", () => {
    const result = updateProfileSchema.parse({
      displayName: "M",
      bio: "",
      city: "",
      username: "pirate",
      avatar_url: "https://evil.example/x.png",
    });
    expect(result).not.toHaveProperty("username");
    expect(result).not.toHaveProperty("avatar_url");
  });
});

describe("cas limites de saisie", () => {
  const messageOf = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
    result.error?.issues[0]?.message;

  describe("usernameSchema", () => {
    it("retire un retour à la ligne final, mais refuse un retour ou une tabulation au milieu", () => {
      expect(usernameSchema.parse("abc\n")).toBe("abc");
      expect(usernameSchema.safeParse("ab\nc").success).toBe(false);
      expect(usernameSchema.safeParse("a\tb").success).toBe(false);
      expect(usernameSchema.safeParse("abc\u0000").success).toBe(false);
    });

    it("refuse les caractères pleine chasse, accentués ou hors ASCII, même normalisés en minuscules", () => {
      for (const bad of ["ａｂｃ", "İstanbul", "éric_92", "abc\u200b", "ab\u00a0c"]) {
        expect(usernameSchema.safeParse(bad).success, bad).toBe(false);
      }
    });

    it("n'accepte que des chaînes (un tableau ou un nombre ne sont pas convertis)", () => {
      for (const bad of [undefined, null, 123, ["abc"], { toString: () => "abc" }]) {
        expect(usernameSchema.safeParse(bad).success).toBe(false);
      }
    });

    it("accepte un pseudo fait uniquement de _ ou de chiffres (aucune règle de réservation en phase 1)", () => {
      expect(usernameSchema.safeParse("___").success).toBe(true);
      expect(usernameSchema.safeParse("123").success).toBe(true);
    });
  });

  describe("passwordSchema", () => {
    it("accepte un mot de passe fait uniquement d'espaces (8 caractères), sans le modifier", () => {
      expect(passwordSchema.parse("        ")).toBe("        ");
    });

    // bcrypt tronque à 72 OCTETS et non à 72 caractères : 40 « é » (80 octets) doivent être refusés.
    it("compte les octets UTF-8 : 36 « é » (72 octets) passent, 37 (74 octets) sont refusés", () => {
      expect(passwordSchema.safeParse("é".repeat(36)).success).toBe(true);
      expect(passwordSchema.safeParse("é".repeat(37)).success).toBe(false);
      expect(passwordSchema.safeParse("é".repeat(40)).success).toBe(false);
    });

    it("compte 4 octets par emoji : 18 emoji passent, 19 sont refusés", () => {
      expect(passwordSchema.safeParse("\u{1F600}".repeat(18)).success).toBe(true);
      expect(passwordSchema.safeParse("\u{1F600}".repeat(19)).success).toBe(false);
    });

    it("compte 3 octets pour « € » : 24 passent, 25 sont refusés", () => {
      expect(passwordSchema.safeParse("€".repeat(24)).success).toBe(true);
      expect(passwordSchema.safeParse("€".repeat(25)).success).toBe(false);
    });

    it("refuse en français quand le mot de passe dépasse 72 octets", () => {
      const result = passwordSchema.safeParse("é".repeat(40));
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.issues[0]?.message).toMatch(/72 octets/);
    });
  });

  describe("updateProfileSchema", () => {
    const base = { displayName: "", bio: "", city: "" };

    it("compte des points de code, comme char_length de PostgreSQL (un emoji compte pour 1)", () => {
      expect(updateProfileSchema.safeParse({ ...base, bio: "🎉".repeat(500) }).success).toBe(true);
      expect(updateProfileSchema.safeParse({ ...base, bio: "🎉".repeat(501) }).success).toBe(false);
      expect(updateProfileSchema.safeParse({ ...base, displayName: "🎉".repeat(50) }).success).toBe(
        true,
      );
    });

    it("mesure après avoir retiré les espaces de bord : 500 caractères entourés d'espaces passent", () => {
      const bio = `  ${"a".repeat(500)}  `;
      expect(updateProfileSchema.parse({ ...base, bio }).bio).toBe("a".repeat(500));
    });

    it("traite une saisie faite uniquement d'espaces insécables ou de retours à la ligne comme vide", () => {
      const result = updateProfileSchema.parse({
        displayName: "\u00a0\u2003 ",
        bio: "\n\n\t",
        city: "\r\n",
      });
      expect(result).toEqual({ displayName: null, bio: null, city: null });
    });

    it("garde les retours à la ligne internes de la bio", () => {
      expect(updateProfileSchema.parse({ ...base, bio: "ligne 1\nligne 2" }).bio).toBe(
        "ligne 1\nligne 2",
      );
    });

    it("refuse une clé manquante ou un type inattendu (le formulaire envoie toujours trois chaînes)", () => {
      expect(updateProfileSchema.safeParse({ displayName: "M" }).success).toBe(false);
      expect(updateProfileSchema.safeParse({ displayName: 5, bio: null, city: {} }).success).toBe(
        false,
      );
    });
  });

  describe("avatarFileSchema : messages destinés à l'utilisateur", () => {
    const parse = (value: unknown) => avatarFileSchema.safeParse(value);

    it("annonce en français un fichier vide, non entier ou illisible", () => {
      expect(messageOf(parse({ type: "image/png", size: 0 }))).toBe("Le fichier est vide");
      expect(messageOf(parse({ type: "image/png", size: -5 }))).toBe("Le fichier est vide");
      expect(messageOf(parse({ type: "image/png", size: 1.5 }))).toBe("Fichier invalide");
      expect(messageOf(parse({ type: "image/png", size: Number.NaN }))).toBe("Fichier invalide");
      expect(messageOf(parse({ type: "image/png" }))).toBe("Fichier invalide");
    });

    it("annonce la limite de taille et les formats acceptés", () => {
      expect(messageOf(parse({ type: "image/png", size: 2 * 1024 * 1024 + 1 }))).toBe(
        "2 Mo maximum",
      );
      expect(messageOf(parse({ type: "image/gif", size: 10 }))).toBe(
        "Formats acceptés : JPEG, PNG, WebP",
      );
      expect(messageOf(parse({ size: 10 }))).toBe("Formats acceptés : JPEG, PNG, WebP");
    });

    it("est sensible à la casse et refuse image/jpg : les clients normalisent avant de valider", () => {
      for (const type of ["IMAGE/PNG", "image/jpg", "image/heic", "image/heif", ""]) {
        expect(parse({ type, size: 10 }).success, type).toBe(false);
      }
    });
  });

  describe("coordinatesSchema", () => {
    const ok = (lat: unknown, lng: unknown) => coordinatesSchema.safeParse({ lat, lng }).success;

    it("accepte les quatre bornes exactes", () => {
      expect(ok(90, 180)).toBe(true);
      expect(ok(-90, -180)).toBe(true);
    });

    it("refuse NaN, l'infini, les chaînes, null et les champs manquants", () => {
      expect(ok(Number.NaN, 0)).toBe(false);
      expect(ok(0, Number.POSITIVE_INFINITY)).toBe(false);
      expect(ok("48.85", 2.35)).toBe(false);
      expect(ok(null, 0)).toBe(false);
      expect(coordinatesSchema.safeParse({}).success).toBe(false);
    });
  });

  describe("searchRadiusSchema", () => {
    it("refuse les rayons non entiers, textuels ou infinis", () => {
      for (const bad of [2.5, "5", Number.NaN, Number.POSITIVE_INFINITY, -5, null, 100]) {
        expect(searchRadiusSchema.safeParse(bad).success, String(bad)).toBe(false);
      }
    });
  });
});

describe("avatarFileSchema", () => {
  it("accepte JPEG, PNG et WebP jusqu'à 2 Mo", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp"]) {
      expect(avatarFileSchema.safeParse({ type, size: 2 * 1024 * 1024 }).success).toBe(true);
    }
  });

  it("refuse SVG et GIF", () => {
    expect(avatarFileSchema.safeParse({ type: "image/svg+xml", size: 100 }).success).toBe(false);
    expect(avatarFileSchema.safeParse({ type: "image/gif", size: 100 }).success).toBe(false);
  });

  it("refuse plus de 2 Mo et un fichier vide", () => {
    expect(
      avatarFileSchema.safeParse({ type: "image/png", size: 2 * 1024 * 1024 + 1 }).success,
    ).toBe(false);
    expect(avatarFileSchema.safeParse({ type: "image/png", size: 0 }).success).toBe(false);
  });
});
