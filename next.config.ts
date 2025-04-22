/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: false,
    turbo: {
      loaders: false,
    },
  },
};

module.exports = nextConfig;
