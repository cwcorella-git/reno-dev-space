'use client'

import { useState, useMemo } from 'react'
import { useContent } from '@/contexts/ContentContext'
import { ContentEntry } from '@/lib/contentStorage'

// Default content items that should always be visible in admin
const DEFAULT_CONTENT: Array<{ id: string; category: string; description: string; defaultValue: string }> = [
  // Intro
  { id: 'intro.hint.title', category: 'intro', description: 'Intro modal title', defaultValue: 'Reno Dev Space' },
  { id: 'intro.hint.subtitle', category: 'intro', description: 'Intro modal subtitle', defaultValue: 'A non-profit game developer space' },
  { id: 'intro.hint.description', category: 'intro', description: 'Intro modal description', defaultValue: 'A community space for indie game developers in Reno to collaborate, share ideas, and build games together. No managers, no gatekeepers—just creators.' },
  { id: 'intro.hint.feature1', category: 'intro', description: 'Feature 1 label', defaultValue: 'Community Chat' },
  { id: 'intro.hint.feature2', category: 'intro', description: 'Feature 2 label', defaultValue: 'Vote on Content' },
  { id: 'intro.hint.feature3', category: 'intro', description: 'Feature 3 label', defaultValue: 'Project Driven' },
  { id: 'intro.hint.joinButton', category: 'intro', description: 'Join button text', defaultValue: 'Join the Community' },
  { id: 'intro.hint.browseButton', category: 'intro', description: 'Browse button text', defaultValue: 'Browse First' },
  // Auth
  { id: 'auth.modal.signupHeader', category: 'auth', description: 'Signup header', defaultValue: 'Create Profile' },
  { id: 'auth.modal.loginHeader', category: 'auth', description: 'Login header', defaultValue: 'Welcome Back' },
  { id: 'auth.modal.signupSubtitle', category: 'auth', description: 'Signup subtitle', defaultValue: 'Add your own ideas, chat with local devs, and help shape what this becomes.' },
  { id: 'auth.modal.loginSubtitle', category: 'auth', description: 'Login subtitle', defaultValue: 'Sign in to continue.' },
  { id: 'auth.modal.displayNameLabel', category: 'auth', description: 'Display name field label', defaultValue: 'Display Name' },
  { id: 'auth.modal.pledgeLabel', category: 'auth', description: 'Pledge field label', defaultValue: 'Chip In' },
  { id: 'auth.modal.pledgeHelper', category: 'auth', description: 'Pledge helper text', defaultValue: "You won't be charged until the countdown hits zero. Change anytime. ($20 min)" },
  // Panel
  { id: 'panel.donate.title', category: 'panel', description: 'Donate tab title', defaultValue: 'Support Reno Dev Space' },
  { id: 'panel.donate.subtitle', category: 'panel', description: 'Donate tab subtitle', defaultValue: "Help fund what we're building" },
  { id: 'panel.donate.secureNote', category: 'panel', description: 'Stripe security note', defaultValue: "Secure payment via Stripe. You'll be redirected to complete payment." },
  { id: 'panel.members.loading', category: 'panel', description: 'Members loading text', defaultValue: 'Loading members...' },
  { id: 'panel.members.error', category: 'panel', description: 'Members error text', defaultValue: 'Error loading members:' },
  { id: 'panel.members.empty', category: 'panel', description: 'No members text', defaultValue: 'No members yet. Be the first to join!' },
  { id: 'panel.members.emptyHint', category: 'panel', description: 'No members hint for signed in user', defaultValue: "(You're signed in but your profile may not be in the database yet)" },
]

export function ContentTab() {
  const { content, updateText } = useContent()
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  // Merge defaults with stored content
  const allContent = useMemo(() => {
    const merged = new Map<string, ContentEntry & { description?: string; defaultValue?: string }>()

    // Add defaults first
    DEFAULT_CONTENT.forEach(item => {
      const stored = content.get(item.id)
      merged.set(item.id, {
        id: item.id,
        value: stored?.value ?? item.defaultValue,
        category: item.category,
        description: item.description,
        defaultValue: item.defaultValue,
        updatedAt: stored?.updatedAt ?? 0,
        updatedBy: stored?.updatedBy ?? '',
      })
    })

    // Add any stored content not in defaults
    content.forEach((entry, id) => {
      if (!merged.has(id)) {
        merged.set(id, entry)
      }
    })

    return merged
  }, [content])

  // Group by category and filter by search
  const groupedContent = useMemo(() => {
    const groups = new Map<string, Array<ContentEntry & { description?: string; defaultValue?: string }>>()

    allContent.forEach((entry) => {
      const matchesSearch = search === '' ||
        entry.id.toLowerCase().includes(search.toLowerCase()) ||
        entry.value.toLowerCase().includes(search.toLowerCase()) ||
        (entry.description?.toLowerCase().includes(search.toLowerCase()))

      if (matchesSearch) {
        const group = groups.get(entry.category) || []
        group.push(entry)
        groups.set(entry.category, group)
      }
    })

    return groups
  }, [allContent, search])

  const handleEdit = (entry: ContentEntry & { description?: string }) => {
    setEditingId(entry.id)
    setEditValue(entry.value)
  }

  const handleSave = async (id: string, category: string, description?: string) => {
    await updateText(id, editValue, category, description)
    setEditingId(null)
  }

  const handleCancel = () => {
    setEditingId(null)
    setEditValue('')
  }

  return (
    <div className="p-4 space-y-4 max-h-[400px] overflow-y-auto">
      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search content..."
        className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
      />

      {/* Content groups */}
      {Array.from(groupedContent.entries()).map(([category, entries]) => (
        <div key={category} className="space-y-2">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            {category}
          </h4>
          <div className="space-y-1">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="bg-white/5 rounded-lg p-3 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <code className="text-xs text-indigo-400">{entry.id}</code>
                    {entry.description && (
                      <p className="text-xs text-gray-500">{entry.description}</p>
                    )}
                  </div>
                  {editingId !== entry.id && (
                    <button
                      onClick={() => handleEdit(entry)}
                      className="text-xs text-indigo-400 hover:text-indigo-300"
                    >
                      Edit
                    </button>
                  )}
                </div>

                {editingId === entry.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="w-full bg-white/10 border border-indigo-500 rounded px-2 py-1 text-sm focus:outline-none min-h-[60px]"
                      autoFocus
                    />
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={handleCancel}
                        className="text-xs px-2 py-1 text-gray-400 hover:text-white"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleSave(entry.id, entry.category, entry.description)}
                        className="text-xs px-2 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-500"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-300">{entry.value}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {groupedContent.size === 0 && (
        <p className="text-center text-gray-500 text-sm py-4">
          No content matches your search.
        </p>
      )}
    </div>
  )
}
