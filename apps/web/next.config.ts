import type { NextConfig } from "next";

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

const nextConfig: NextConfig = {
  // Les packages workspace sont exportés en TypeScript source, sans étape de build.
  transpilePackages: ["@yakila/api", "@yakila/types", "@yakila/utils", "@yakila/validation"],
  images: { remotePatterns: avatarImagePatterns() },
};

export default nextConfig;
