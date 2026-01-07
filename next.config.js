/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  basePath: '/reno-dev-space',
  assetPrefix: '/reno-dev-space/',
}

module.exports = nextConfig
