/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  },
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