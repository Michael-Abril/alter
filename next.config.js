const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow HMR / dev assets when the app is opened at http://127.0.0.1:3000 (cross-origin vs localhost).
  allowedDevOrigins: ['127.0.0.1'],
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
        pathname: '/**',
      },
    ],
  },
  // Dev (`npm run dev` uses webpack): avoid ChunkLoadError when first compile of a client chunk
  // exceeds the default script timeout (common with heavy root layouts).
  webpack: (config, { dev }) => {
    if (dev) {
      config.output = config.output || {};
      config.output.chunkLoadTimeout = 300000;
    }
    return config;
  },
};

module.exports = nextConfig;
