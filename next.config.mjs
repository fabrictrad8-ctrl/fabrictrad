import { imageHosts } from './image-hosts.config.mjs';

const publicSupabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://rdhfwlzhcvwjhkxhhpoo.supabase.co';
const publicSupabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkaGZ3bHpoY3Z3amhreGhocG9vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMzMwNjMsImV4cCI6MjA5OTcwOTA2M30.jLF4AD-joIbRslei-T55lwZBdRpntrsU-hjyHCZXgVc';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  productionBrowserSourceMaps: false,
  distDir: process.env.DIST_DIR || '.next',

  env: {
    NEXT_PUBLIC_SUPABASE_URL: publicSupabaseUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: publicSupabaseAnonKey,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || 'https://fabrictrad.com',
    NEXT_PUBLIC_ENABLE_GOOGLE_AUTH:
      process.env.NEXT_PUBLIC_ENABLE_GOOGLE_AUTH || 'true',
  },

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

  images: {
    remotePatterns: imageHosts,
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 86400,
    deviceSizes: [360, 480, 640, 750, 828, 1080, 1200, 1440, 1920],
    imageSizes: [24, 32, 48, 64, 96, 128, 256, 384],
    qualities: [70, 75, 85, 100],
  },

  webpack(config, { dev }) {
if (dev) {
    config.module.rules.push({
      test: /\.(jsx|tsx)$/,
      exclude: [/node_modules/],
      use: [{
        loader: '@dhiwise/component-tagger/nextLoader',
      }],
    });
  }

    return config;
  }
};

export default nextConfig;
