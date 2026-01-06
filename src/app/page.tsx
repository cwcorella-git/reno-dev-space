'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { IdeasBoard } from '@/components/IdeasBoard'
import { ActiveVotes } from '@/components/ActiveVotes'
import { AuthModal } from '@/components/AuthModal'

export default function Home() {
  const { user } = useAuth()
  const [showAuthModal, setShowAuthModal] = useState(false)

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Hero Section */}
      <section className="text-center mb-16">
        <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-brand-primary via-brand-secondary to-brand-accent bg-clip-text text-transparent">
          Reno Dev Space
        </h1>
        <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-8">
          A game developer collective for creators who want to build together,
          keep what they make, and share the cost of a dedicated workspace.
        </p>
        <div className="flex justify-center gap-4 flex-wrap">
          {!user ? (
            <button
              onClick={() => setShowAuthModal(true)}
              className="bg-brand-primary hover:bg-brand-secondary text-white px-8 py-3 rounded-lg font-semibold transition-colors"
            >
              Join the Collective
            </button>
          ) : (
            <a
              href="/governance"
              className="bg-brand-primary hover:bg-brand-secondary text-white px-8 py-3 rounded-lg font-semibold transition-colors"
            >
              Vote on Proposals
            </a>
          )}
          <a
            href="/about"
            className="border border-white/30 hover:border-white/50 text-white px-8 py-3 rounded-lg font-semibold transition-colors"
          >
            Learn More
          </a>
        </div>
      </section>

      {/* The Pitch */}
      <section className="mb-16 bg-white/5 backdrop-blur rounded-xl p-8">
        <h2 className="text-3xl font-bold mb-6">The Vision</h2>
        <div className="grid md:grid-cols-2 gap-8 text-gray-300">
          <div>
            <h3 className="text-xl font-semibold text-white mb-3">What We Are</h3>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-brand-accent">&#10003;</span>
                A shared workspace for game developers in Reno
              </li>
              <li className="flex items-start gap-2">
                <span className="text-brand-accent">&#10003;</span>
                Non-profit &mdash; we fund the space, not investors
              </li>
              <li className="flex items-start gap-2">
                <span className="text-brand-accent">&#10003;</span>
                Horizontal structure &mdash; no executives, no producers
              </li>
              <li className="flex items-start gap-2">
                <span className="text-brand-accent">&#10003;</span>
                Free association &mdash; work on what excites you
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-xl font-semibold text-white mb-3">What We&apos;re Not</h3>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-red-400">&#10007;</span>
                Not rev-share &mdash; you keep 100% of your work
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-400">&#10007;</span>
                Not a startup &mdash; no equity, no exit strategy
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-400">&#10007;</span>
                Not exclusive &mdash; hobbyists and pros welcome
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-400">&#10007;</span>
                Not extractive &mdash; success doesn&apos;t mean giving back
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Active Votes */}
      <section className="mb-16">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-3xl font-bold">Active Votes</h2>
          {user && (
            <a
              href="/governance"
              className="text-brand-accent hover:underline"
            >
              View All &rarr;
            </a>
          )}
        </div>
        <ActiveVotes limit={3} />
      </section>

      {/* Ideas Board */}
      <section className="mb-16">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-3xl font-bold">Community Ideas</h2>
          {user && (
            <a
              href="/governance"
              className="text-brand-accent hover:underline"
            >
              Propose an Idea &rarr;
            </a>
          )}
        </div>
        <IdeasBoard />
      </section>

      {/* Who We Want */}
      <section className="bg-gradient-to-r from-brand-primary/20 to-brand-secondary/20 rounded-xl p-8">
        <h2 className="text-3xl font-bold mb-6">Who We&apos;re Looking For</h2>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-4xl mb-3">🎨</div>
            <h3 className="font-semibold mb-2">Artists &amp; Animators</h3>
            <p className="text-gray-300 text-sm">2D, 3D, pixel art, character design, environments</p>
          </div>
          <div className="text-center">
            <div className="text-4xl mb-3">💻</div>
            <h3 className="font-semibold mb-2">Programmers</h3>
            <p className="text-gray-300 text-sm">Engine devs, tools programmers, gameplay coders</p>
          </div>
          <div className="text-center">
            <div className="text-4xl mb-3">🎵</div>
            <h3 className="font-semibold mb-2">Audio Creators</h3>
            <p className="text-gray-300 text-sm">Composers, sound designers, voice actors</p>
          </div>
          <div className="text-center">
            <div className="text-4xl mb-3">✍️</div>
            <h3 className="font-semibold mb-2">Writers</h3>
            <p className="text-gray-300 text-sm">Narrative designers, world-builders, dialogue</p>
          </div>
          <div className="text-center">
            <div className="text-4xl mb-3">🎮</div>
            <h3 className="font-semibold mb-2">Designers</h3>
            <p className="text-gray-300 text-sm">Game designers, level designers, UX</p>
          </div>
          <div className="text-center">
            <div className="text-4xl mb-3">🌟</div>
            <h3 className="font-semibold mb-2">Enthusiasts</h3>
            <p className="text-gray-300 text-sm">Just starting out? Perfect. Let&apos;s learn together.</p>
          </div>
        </div>
      </section>

      {showAuthModal && (
        <AuthModal onClose={() => setShowAuthModal(false)} />
      )}
    </div>
  )
}
