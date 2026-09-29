// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ✅ Enable Cache Components (required for "use cache" directive)
  cacheComponents: true,

  // ✅ Increase Server Action body size limit (default is 1 MB)
  // Allows uploading images up to 10 MB through Server Actions.
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },

  // ✅ Allow ALL remote image hostnames
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**", // allows any hostname over HTTPS
      },
      {
        protocol: "http",
        hostname: "**", // allows any hostname over HTTP
      },
    ],
  },
};

export default nextConfig;