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
  // Served from the apex domain root (renodevspace.org) — no subpath
  basePath: '',
  assetPrefix: '',
  env: {
    NEXT_PUBLIC_COMMIT_SHA: commitSha,
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
  },
}

module.exports = nextConfig
