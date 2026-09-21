import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";

/** Origine (`https://xxx.supabase.co`) du projet Supabase, ou `null` s'il manque (CI) ou est invalide. */
function supabaseOrigin(): string | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return null;
  try {
    return new URL(supabaseUrl).origin;
  } catch {
    return null;
  }
}

/**
 * Autorise `next/image` à optimiser uniquement les avatars du bucket public de notre projet
 * Supabase. Sans variable (CI), aucun motif : le build passe, aucune image distante n'est servie.
 */
function avatarImagePatterns(): NonNullable<NextConfig["images"]>["remotePatterns"] {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return [];
  try {
    const { protocol, hostname, port } = new URL(supabaseUrl);
    return [
      {
        protocol: protocol === "http:" ? "http" : "https",
        hostname,
        port,
        pathname: "/storage/v1/object/public/avatars/**",
      },
    ];
  } catch {
    return [];
  }
}

/**
 * Content-Security-Policy PARTIELLE : pas de `default-src` ni de `script-src`. Next injecte des
 * scripts en ligne (hydratation, flux RSC) : les bloquer exigerait un nonce par requête, ce qui force
 * toutes les pages en rendu dynamique (voir `docs/01-app/02-guides/content-security-policy.md`) et
 * interdirait de mettre en cache les pages publiques (SEO) plus tard. On garde donc les directives
 * sans effet sur l'hydratation : anti-clickjacking, pas de plugins, pas de `<base>` détourné,
 * formulaires limités à notre origine, images limitées à nous et à notre projet Supabase.
 * (`blob:` volontairement absent : aucun aperçu local d'image n'est affiché.)
 */
function contentSecurityPolicy(): string {
  const origin = supabaseOrigin();
  const imgSrc = ["'self'", "data:", ...(origin ? [origin] : [])];
  return [
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    `img-src ${imgSrc.join(" ")}`,
  ].join("; ");
}

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy() },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "geolocation=(self), camera=(), microphone=()" },
  // HSTS uniquement en production : sur http://localhost il serait ignoré, et un HSTS posé par erreur
  // sur un domaine de test est pénible à retirer côté navigateur.
  ...(isProduction
    ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
    : []),
];

const nextConfig: NextConfig = {
  // Les packages workspace sont exportés en TypeScript source, sans étape de build.
  transpilePackages: ["@yakila/api", "@yakila/types", "@yakila/utils", "@yakila/validation"],
  images: { remotePatterns: avatarImagePatterns() },
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
