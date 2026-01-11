'use client'

export function IntroHint() {
  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 max-w-md text-center">
      <div className="bg-black/80 backdrop-blur-sm border border-white/10 rounded-xl px-6 py-4">
        <p className="text-white font-medium mb-1">
          Reno Dev Space
        </p>
        <p className="text-gray-400 text-sm">
          Local game devs making things together. Sign in to join.
        </p>
      </div>
    </div>
  )
}
