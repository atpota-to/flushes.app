/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['bsky.social', 'cdn.bsky.app'],
  },
  // We need to specify which pages need to be dynamic
  // to prevent build errors with pages that use client-side features
  output: 'standalone',
};

module.exports = nextConfig;