import { describe, expect, it } from "vitest";
import { formatDistanceKm } from "./index";

describe("formatDistanceKm", () => {
  it("affiche les mètres sous 1 km", () => {
    expect(formatDistanceKm(0.85)).toBe("850 m");
  });

  it("affiche une décimale sous 10 km", () => {
    expect(formatDistanceKm(3.24)).toBe("3,2 km");
  });

  it("arrondit à l'entier au-delà", () => {
    expect(formatDistanceKm(12.4)).toBe("12 km");
  });
});
