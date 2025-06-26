/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['public.api.bsky.app', 'cdn.bsky.app'],
  },
  // We need to specify which pages need to be dynamic
  // to prevent build errors with pages that use client-side features
  output: 'standalone',
  
  // Configure static generation behavior
  experimental: {
    // This ensures packages with browser APIs are treated properly
    serverComponentsExternalPackages: ['@supabase/supabase-js', '@atproto/api'],
  },
  
  // Make sure all API routes are generated with server-side functionality
  serverActions: {
    bodySizeLimit: '2mb',
  }
};

module.exports = nextConfig;