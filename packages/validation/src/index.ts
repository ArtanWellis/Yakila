import { z } from "zod";
import { SEARCH_RADII_KM } from "@yakila/types";

export const coordinatesSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const searchRadiusSchema = z
  .number()
  .refine((km): km is (typeof SEARCH_RADII_KM)[number] => SEARCH_RADII_KM.some((r) => r === km), {
    message: "Rayon de recherche invalide",
  });
