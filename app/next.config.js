/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['bsky.social', 'cdn.bsky.app'],
  },
};

module.exports = nextConfig;