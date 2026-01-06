/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  // Update this when deploying to GitHub Pages
  // basePath: '/reno-dev-space',
}

module.exports = nextConfig
