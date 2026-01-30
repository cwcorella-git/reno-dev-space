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
  { id: 'auth.label.email', category: 'auth', description: 'Email field label', defaultValue: 'Email' },
  { id: 'auth.label.password', category: 'auth', description: 'Password field label', defaultValue: 'Password' },
  { id: 'auth.placeholder.displayName', category: 'auth', description: 'Display name placeholder', defaultValue: 'How should we call you?' },
  { id: 'auth.placeholder.email', category: 'auth', description: 'Email placeholder', defaultValue: 'you@example.com' },
  { id: 'auth.placeholder.password', category: 'auth', description: 'Password placeholder', defaultValue: 'At least 6 characters' },
  { id: 'auth.placeholder.pledge', category: 'auth', description: 'Pledge placeholder', defaultValue: 'How much would you pledge?' },
  { id: 'auth.button.loading', category: 'auth', description: 'Loading button text', defaultValue: 'Please wait...' },
  { id: 'auth.button.signup', category: 'auth', description: 'Signup button text', defaultValue: 'Create Account' },
  { id: 'auth.button.login', category: 'auth', description: 'Login button text', defaultValue: 'Sign In' },
  { id: 'auth.toggle.hasAccount', category: 'auth', description: 'Has account toggle text', defaultValue: 'Already have an account?' },
  { id: 'auth.toggle.signIn', category: 'auth', description: 'Sign in link text', defaultValue: 'Sign in' },
  { id: 'auth.toggle.newHere', category: 'auth', description: 'New here toggle text', defaultValue: 'New here?' },
  { id: 'auth.toggle.createAccount', category: 'auth', description: 'Create account link text', defaultValue: 'Create an account' },
  { id: 'auth.error.displayName', category: 'auth', description: 'Display name error', defaultValue: 'Please enter a display name' },
  { id: 'auth.error.pledgeAmount', category: 'auth', description: 'Pledge amount error', defaultValue: 'Please enter a pledge amount ($20 minimum)' },
  // Panel
  { id: 'panel.button.signIn', category: 'panel', description: 'Sign in button (logged out)', defaultValue: 'Sign In' },
  { id: 'panel.button.cancel', category: 'panel', description: 'Cancel add text button', defaultValue: 'Cancel' },
  { id: 'panel.button.addText', category: 'panel', description: 'Add text button', defaultValue: 'Add Text' },
  { id: 'panel.tab.editor', category: 'panel', description: 'Editor tab label', defaultValue: 'Editor' },
  { id: 'panel.tab.chat', category: 'panel', description: 'Chat tab label', defaultValue: 'Chat' },
  { id: 'panel.tab.members', category: 'panel', description: 'Members tab label', defaultValue: 'Members' },
  { id: 'panel.tab.profile', category: 'panel', description: 'Profile tab label', defaultValue: 'Profile' },
  { id: 'panel.donate.title', category: 'panel', description: 'Donate tab title', defaultValue: 'Support Reno Dev Space' },
  { id: 'panel.donate.subtitle', category: 'panel', description: 'Donate tab subtitle', defaultValue: "Help fund what we're building" },
  { id: 'panel.donate.secureNote', category: 'panel', description: 'Stripe security note', defaultValue: "Secure payment via Stripe. You'll be redirected to complete payment." },
  { id: 'panel.members.loading', category: 'panel', description: 'Members loading text', defaultValue: 'Loading members...' },
  { id: 'panel.members.error', category: 'panel', description: 'Members error text', defaultValue: 'Error loading members:' },
  { id: 'panel.members.empty', category: 'panel', description: 'No members text', defaultValue: 'No members yet. Be the first to join!' },
  { id: 'panel.members.emptyHint', category: 'panel', description: 'No members hint for signed in user', defaultValue: "(You're signed in but your profile may not be in the database yet)" },
  // Editor
  { id: 'editor.hint.select', category: 'editor', description: 'No block selected hint', defaultValue: 'Select a text block to edit' },
  { id: 'editor.hint.ownBlocks', category: 'editor', description: 'Cannot edit hint', defaultValue: 'You can only edit your own blocks' },
  { id: 'editor.button.delete', category: 'editor', description: 'Delete block button', defaultValue: 'Delete Block' },
  // Chat
  { id: 'chat.status.connected', category: 'chat', description: 'Connected status', defaultValue: 'Connected' },
  { id: 'chat.status.connecting', category: 'chat', description: 'Connecting status', defaultValue: 'Connecting...' },
  { id: 'chat.empty.title', category: 'chat', description: 'Empty chat title', defaultValue: 'No messages yet' },
  { id: 'chat.empty.subtitle', category: 'chat', description: 'Empty chat subtitle', defaultValue: 'Start the conversation!' },
  { id: 'chat.button.send', category: 'chat', description: 'Send button', defaultValue: 'Send' },
  { id: 'chat.hint.signIn', category: 'chat', description: 'Sign in to chat hint', defaultValue: 'Sign in to send messages' },
  { id: 'chat.placeholder.message', category: 'chat', description: 'Message input placeholder', defaultValue: 'Type a message...' },
  { id: 'chat.placeholder.connecting', category: 'chat', description: 'Connecting placeholder', defaultValue: 'Connecting...' },
  // Members
  { id: 'members.header.name', category: 'members', description: 'Name column header', defaultValue: 'Name' },
  { id: 'members.header.blocks', category: 'members', description: 'Blocks column header', defaultValue: 'Blocks' },
  { id: 'members.header.votes', category: 'members', description: 'Votes column header', defaultValue: 'Votes' },
  { id: 'members.header.pledge', category: 'members', description: 'Pledge column header', defaultValue: 'Pledge' },
  { id: 'members.header.joined', category: 'members', description: 'Joined column header', defaultValue: 'Joined' },
  { id: 'members.badge.you', category: 'members', description: 'Current user badge', defaultValue: 'you' },
  { id: 'members.badge.backer', category: 'members', description: 'Backer badge', defaultValue: 'backer' },
  // Donate
  { id: 'donate.label.or', category: 'donate', description: 'Or label between presets and custom', defaultValue: 'or' },
  { id: 'donate.placeholder.custom', category: 'donate', description: 'Custom amount placeholder', defaultValue: 'Custom' },
  { id: 'donate.error.minAmount', category: 'donate', description: 'Minimum amount error', defaultValue: 'Please enter an amount of at least $1' },
  { id: 'donate.button.processing', category: 'donate', description: 'Processing button text', defaultValue: 'Processing...' },
  { id: 'donate.button.donate', category: 'donate', description: 'Donate button text', defaultValue: 'Donate' },
  // Profile
  { id: 'profile.heading.pledge', category: 'profile', description: 'Pledge section heading', defaultValue: 'My Pledge' },
  { id: 'profile.pledge.yourPledge', category: 'profile', description: 'Your pledge label', defaultValue: 'Your pledge:' },
  { id: 'profile.pledge.ended', category: 'profile', description: 'Campaign ended text', defaultValue: 'Campaign ended' },
  { id: 'profile.heading.account', category: 'profile', description: 'Account section heading', defaultValue: 'Account' },
  { id: 'profile.confirm.clearVotes', category: 'profile', description: 'Clear votes confirmation', defaultValue: 'Clear all your votes?' },
  { id: 'profile.confirm.deleteContent', category: 'profile', description: 'Delete content confirmation', defaultValue: 'Delete all content you created?' },
  { id: 'profile.confirm.deleteAccount', category: 'profile', description: 'Delete account confirmation', defaultValue: 'Permanently delete your account?' },
  { id: 'profile.button.cancel', category: 'profile', description: 'Cancel button', defaultValue: 'Cancel' },
  { id: 'profile.button.confirm', category: 'profile', description: 'Confirm button', defaultValue: 'Confirm' },
  { id: 'profile.badge.admin', category: 'profile', description: 'Admin badge', defaultValue: 'Admin' },
  { id: 'profile.button.update', category: 'profile', description: 'Update pledge button', defaultValue: 'Update' },
  { id: 'profile.button.pledge', category: 'profile', description: 'Pledge button', defaultValue: 'Pledge' },
  { id: 'profile.button.clearVotes', category: 'profile', description: 'Clear votes button', defaultValue: 'Clear Votes' },
  { id: 'profile.button.deleteContent', category: 'profile', description: 'Delete content button', defaultValue: 'Delete Content' },
  { id: 'profile.button.deleteAccount', category: 'profile', description: 'Delete account button', defaultValue: 'Delete Account' },
  { id: 'profile.button.signOut', category: 'profile', description: 'Sign out button', defaultValue: 'Sign Out' },
  // Campaign banner
  { id: 'campaign.banner.teaser', category: 'campaign', description: 'Inert banner teaser text', defaultValue: 'A campaign is brewing...' },
  { id: 'campaign.banner.ready', category: 'campaign', description: 'Ready to launch text', defaultValue: "We're ready to launch!" },
  { id: 'campaign.banner.memberCount', category: 'campaign', description: 'Member count label', defaultValue: 'members' },
  { id: 'campaign.banner.goal', category: 'campaign', description: 'Goal reached text', defaultValue: 'GOAL!' },
  { id: 'campaign.banner.complete', category: 'campaign', description: 'Campaign complete text', defaultValue: 'Complete' },
  { id: 'campaign.banner.donate', category: 'campaign', description: 'Banner donate button', defaultValue: 'Donate' },
  // Canvas
  { id: 'canvas.empty.title', category: 'canvas', description: 'Empty canvas title', defaultValue: 'Your canvas is empty' },
  { id: 'canvas.empty.subtitle', category: 'canvas', description: 'Empty canvas subtitle', defaultValue: 'Tap the + button or right-click to add text' },
  { id: 'canvas.addText.overlapping', category: 'canvas', description: 'Overlap warning', defaultValue: "Can't place here – overlapping" },
  { id: 'canvas.addText.clickToPlace', category: 'canvas', description: 'Click to place hint', defaultValue: 'Click to place text' },
  { id: 'canvas.contextMenu.addText', category: 'canvas', description: 'Context menu add text', defaultValue: 'Add Text' },
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
