import { imageHosts } from './image-hosts.config.mjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  productionBrowserSourceMaps: false,
  distDir: process.env.DIST_DIR || '.next',
  outputFileTracingExcludes: {
    '*': [
      './node_modules/@esbuild/**/*',
      './node_modules/esbuild/**/*',
      './node_modules/webpack/**/*',
      './node_modules/minimizer-webpack-plugin/**/*',
      './node_modules/terser/**/*',
      './node_modules/@webassemblyjs/**/*',
    ],
  },

  typescript: {
    ignoreBuildErrors: true,
  },

  eslint: {
    ignoreDuringBuilds: true,
  },

  images: {
    remotePatterns: imageHosts,
    minimumCacheTTL: 60,
    qualities: [75, 85, 100],
  }
};
export default nextConfig;
