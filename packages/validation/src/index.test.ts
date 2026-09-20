import { describe, expect, it } from "vitest";
import { coordinatesSchema, searchRadiusSchema } from "./index";

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

  it("accepte Évry", () => {
    expect(coordinatesSchema.safeParse({ lat: 48.6237, lng: 2.4297 }).success).toBe(true);
  });
});
