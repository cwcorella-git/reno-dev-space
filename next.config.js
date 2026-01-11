const { execSync } = require('child_process')

// Get git commit hash at build time
let commitSha = 'unknown'
try {
  commitSha = execSync('git rev-parse --short HEAD').toString().trim()
} catch (e) {
  // Fallback if git not available
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  basePath: '/reno-dev-space',
  assetPrefix: '/reno-dev-space/',
  env: {
    NEXT_PUBLIC_COMMIT_SHA: commitSha,
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
  },
}

module.exports = nextConfig
