'use client'

export function VersionTag() {
  const commitSha = process.env.NEXT_PUBLIC_COMMIT_SHA || 'dev'
  const shortSha = commitSha.slice(0, 7)

  return (
    <div className="fixed bottom-2 right-2 z-30 text-xs text-gray-500 font-mono">
      {shortSha}
    </div>
  )
}
