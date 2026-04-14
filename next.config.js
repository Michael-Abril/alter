const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Next otherwise picks the parent folder when another package-lock.json exists (e.g. in ~),
  // which loads the wrong node_modules and breaks Prisma / other native deps in dev.
  turbopack: {
    root: path.join(__dirname),
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.clerk.accounts.dev',
      },
    ],
  },
};

module.exports = nextConfig;
