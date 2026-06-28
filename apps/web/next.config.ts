import type { NextConfig } from "next";
import path from "node:path";

// Allow a single browser key in dev: server-side Places calls reuse NEXT_PUBLIC when GOOGLE_MAPS_API_KEY is unset.
if (!process.env.GOOGLE_MAPS_API_KEY?.trim() && process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim()) {
  process.env.GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
}

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(process.cwd(), "../.."),
  },
  transpilePackages: [
    "@where2go/core",
    "@where2go/providers",
    "@where2go/schemas"
  ],
};

export default nextConfig;
