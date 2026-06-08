const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  turbopack: {
    root: path.resolve(__dirname)
  },
  serverExternalPackages: ['@google/earthengine'],
  async rewrites() {
    return [
      {
        source: '/api/gdacs-feed',
        destination: 'https://gdacs.org/xml/rss.xml',
      },
    ];
  },
}

module.exports = nextConfig
