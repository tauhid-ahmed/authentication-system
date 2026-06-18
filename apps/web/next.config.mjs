/** @type {import('next').NextConfig} */
const nextConfig = {
  // Transpile the shared package
  transpilePackages: ["@auth/shared"],

  // Experimental features
  experimental: {},

  // Strict mode for React
  reactStrictMode: true,

  // Image domains (for future OAuth avatars)
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
    ],
  },
};

export default nextConfig;
