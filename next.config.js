/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['mongodb']
  },
  webpack: (config, { isServer }) => {
    // Data klasörünü bundle'a dahil et
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push({
        'fs': 'fs',
        'path': 'path'
      });
    }
    return config;
  }
}

module.exports = nextConfig 