import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Les packages workspace sont exportés en TypeScript source, sans étape de build.
  transpilePackages: ["@yakila/api", "@yakila/types", "@yakila/utils", "@yakila/validation"],
};

export default nextConfig;
