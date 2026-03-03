'use client'

import { useState, useMemo } from 'react'
import { useContent } from '@/contexts/ContentContext'
import { ContentEntry } from '@/lib/storage/contentStorage'

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
  { id: 'auth.error.banned', category: 'auth', description: 'Banned email error', defaultValue: 'This email address has been banned' },
  { id: 'auth.verification.header', category: 'auth', description: 'Verification email header', defaultValue: 'Check your email' },
  { id: 'auth.verification.sentTo', category: 'auth', description: 'Verification sent message', defaultValue: 'We sent a verification link to' },
  { id: 'auth.verification.checkSpam', category: 'auth', description: 'Spam folder warning', defaultValue: 'Check your spam folder — it often ends up there!' },
  { id: 'auth.verification.gotIt', category: 'auth', description: 'Got it button', defaultValue: 'Got it' },
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
  { id: 'panel.admin.required', category: 'panel', description: 'Admin access guard message', defaultValue: 'Admin access required' },
  // Editor
  { id: 'editor.hint.select', category: 'editor', description: 'No block selected hint', defaultValue: 'Select a text block to edit' },
  { id: 'editor.hint.ownBlocks', category: 'editor', description: 'Cannot edit hint', defaultValue: 'You can only edit your own blocks' },
  { id: 'editor.button.delete', category: 'editor', description: 'Delete block button', defaultValue: 'Delete Block' },
  { id: 'editor.alert.selectText', category: 'editor', description: 'Alert when no text selected for link', defaultValue: 'Select some text first' },
  { id: 'editor.prompt.enterUrl', category: 'editor', description: 'Prompt for link URL', defaultValue: 'Enter URL:' },
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
  { id: 'members.badge.admin', category: 'members', description: 'Admin badge in members list', defaultValue: 'admin' },
  { id: 'members.badge.banned', category: 'members', description: 'Banned badge in members list', defaultValue: 'banned' },
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
  { id: 'profile.verification.notVerified', category: 'profile', description: 'Email not verified warning', defaultValue: 'Email not verified' },
  { id: 'profile.verification.resend', category: 'profile', description: 'Resend verification button', defaultValue: 'Resend' },
  { id: 'profile.verification.sent', category: 'profile', description: 'Verification sent success', defaultValue: 'Verification email sent! Check your spam folder.' },
  // Effects
  { id: 'effects.toggle.celebrations', category: 'effects', description: 'Celebrations toggle label', defaultValue: 'Celebrations' },
  { id: 'effects.toggle.on', category: 'effects', description: 'On state', defaultValue: 'On' },
  { id: 'effects.toggle.off', category: 'effects', description: 'Off state', defaultValue: 'Off' },
  { id: 'effects.description', category: 'effects', description: 'Effects panel description', defaultValue: 'One-shot effects that play when a block receives an upvote. Visible only to the voter.' },
  { id: 'effects.testMode.label', category: 'effects', description: 'Test Mode label', defaultValue: 'Test Mode' },
  { id: 'effects.testMode.description', category: 'effects', description: 'Test Mode description', defaultValue: 'Unlimited votes, random effects' },
  // Campaign banner
  { id: 'campaign.banner.teaser', category: 'campaign', description: 'Inert banner teaser text', defaultValue: 'A campaign is brewing...' },
  { id: 'campaign.banner.ready', category: 'campaign', description: 'Ready to launch text', defaultValue: "We're ready to launch!" },
  { id: 'campaign.banner.memberCount', category: 'campaign', description: 'Member count label', defaultValue: 'members' },
  { id: 'campaign.banner.goal', category: 'campaign', description: 'Goal reached text', defaultValue: 'GOAL!' },
  { id: 'campaign.banner.complete', category: 'campaign', description: 'Campaign complete text', defaultValue: 'Complete' },
  { id: 'campaign.banner.donate', category: 'campaign', description: 'Banner donate button', defaultValue: 'Donate' },
  { id: 'campaign.confirm.resetBrightness', category: 'campaign', description: 'Reset brightness confirmation', defaultValue: 'Reset brightness for all blocks?' },
  { id: 'campaign.button.cancel', category: 'campaign', description: 'Cancel button in campaign panel', defaultValue: 'Cancel' },
  { id: 'campaign.button.confirm', category: 'campaign', description: 'Confirm button in campaign panel', defaultValue: 'Confirm' },
  { id: 'campaign.label.timer', category: 'campaign', description: 'Timer section label', defaultValue: 'Timer' },
  { id: 'campaign.button.reset', category: 'campaign', description: 'Reset timer button', defaultValue: 'Reset' },
  { id: 'campaign.button.start', category: 'campaign', description: 'Start timer button', defaultValue: 'Start' },
  { id: 'campaign.button.unlock', category: 'campaign', description: 'Unlock editing button', defaultValue: 'Unlock' },
  { id: 'campaign.button.lock', category: 'campaign', description: 'Lock editing button', defaultValue: 'Lock' },
  { id: 'campaign.button.resetVotes', category: 'campaign', description: 'Reset votes button', defaultValue: 'Reset Votes' },
  { id: 'campaign.label.goal', category: 'campaign', description: 'Goal section label', defaultValue: 'Goal' },
  { id: 'campaign.button.set', category: 'campaign', description: 'Set goal button', defaultValue: 'Set' },
  { id: 'campaign.status.resetBrightness', category: 'campaign', description: 'Reset brightness status message', defaultValue: 'Reset brightness for {count} block(s)' },
  // Canvas
  { id: 'canvas.empty.title', category: 'canvas', description: 'Empty canvas title', defaultValue: 'Your canvas is empty' },
  { id: 'canvas.empty.subtitle', category: 'canvas', description: 'Empty canvas subtitle', defaultValue: 'Tap the + button or right-click to add text' },
  { id: 'canvas.addText.overlapping', category: 'canvas', description: 'Overlap warning', defaultValue: "Can't place here – overlapping" },
  { id: 'canvas.addText.clickToPlace', category: 'canvas', description: 'Click to place hint', defaultValue: 'Click to place text' },
  { id: 'canvas.contextMenu.addText', category: 'canvas', description: 'Context menu add text', defaultValue: 'Add Text' },
  { id: 'canvas.label.desktopView', category: 'canvas', description: 'Desktop view overlay label', defaultValue: 'desktop view' },
  { id: 'canvas.label.mobileView', category: 'canvas', description: 'Mobile view overlay label', defaultValue: 'mobile view' },
  { id: 'canvas.placeholder.text', category: 'canvas', description: 'Empty text block placeholder', defaultValue: 'Click to edit' },
  // Property Gallery
  { id: 'property.gallery.loading', category: 'property', description: 'Loading properties text', defaultValue: 'Loading properties...' },
  { id: 'property.gallery.empty', category: 'property', description: 'No properties message', defaultValue: 'No rental properties yet. Be the first to suggest one!' },
  { id: 'property.gallery.title', category: 'property', description: 'Gallery heading', defaultValue: 'Potential Spaces' },
  { id: 'property.gallery.addButton', category: 'property', description: 'Add property button', defaultValue: 'Add Property' },
  // Property Carousel
  { id: 'property.carousel.counter', category: 'property', description: 'Property counter (use {current} and {total})', defaultValue: 'Property {current} of {total}' },
  // Property Card
  { id: 'property.card.archived', category: 'property', description: 'Archived overlay text', defaultValue: 'ARCHIVED' },
  { id: 'property.card.rentSuffix', category: 'property', description: 'Monthly rent suffix', defaultValue: '/mo' },
  { id: 'property.card.rentUnknown', category: 'property', description: 'Unknown rent placeholder', defaultValue: '???' },
  // Property Modal
  { id: 'property.modal.title', category: 'property', description: 'Add property modal title', defaultValue: 'Add Rental Property' },
  { id: 'property.modal.closeHint', category: 'property', description: 'Press ESC to close hint', defaultValue: 'Press ESC to close or click outside' },
  { id: 'property.label.image', category: 'property', description: 'Image field label', defaultValue: 'Image' },
  { id: 'property.upload.clickOrDrag', category: 'property', description: 'Upload zone instructions', defaultValue: 'Click to upload or drag and drop' },
  { id: 'property.upload.fileTypes', category: 'property', description: 'Accepted file types', defaultValue: 'JPEG, PNG, WebP (max 5MB)' },
  { id: 'property.label.address', category: 'property', description: 'Address field label', defaultValue: 'Address' },
  { id: 'property.placeholder.address', category: 'property', description: 'Address field placeholder', defaultValue: '123 Main St, Reno, NV 89501' },
  { id: 'property.label.rent', category: 'property', description: 'Rent field label', defaultValue: 'Monthly Rent (optional)' },
  { id: 'property.placeholder.rent', category: 'property', description: 'Rent field placeholder', defaultValue: '2,500' },
  { id: 'property.hint.blankRent', category: 'property', description: 'Blank rent hint', defaultValue: 'Leave blank to show "???"' },
  { id: 'property.label.description', category: 'property', description: 'Description field label', defaultValue: 'Why is this a good space?' },
  { id: 'property.placeholder.description', category: 'property', description: 'Description placeholder', defaultValue: 'Great location near downtown, 1500 sq ft, flexible lease terms...' },
  { id: 'property.hint.minChars', category: 'property', description: 'Character count hint (use {count})', defaultValue: '{count} / 20 characters minimum' },
  { id: 'property.button.cancel', category: 'property', description: 'Cancel button', defaultValue: 'Cancel' },
  { id: 'property.button.add', category: 'property', description: 'Add property button', defaultValue: 'Add Property' },
  { id: 'property.button.uploading', category: 'property', description: 'Uploading state button', defaultValue: 'Uploading...' },
  // Property Errors
  { id: 'property.error.fileType', category: 'property', description: 'Invalid file type error', defaultValue: 'Please upload a JPEG, PNG, or WebP image' },
  { id: 'property.error.fileSize', category: 'property', description: 'File too large error', defaultValue: 'Image must be under 5MB' },
  { id: 'property.error.imageRequired', category: 'property', description: 'Image required error', defaultValue: 'Image is required' },
  { id: 'property.error.addressTooShort', category: 'property', description: 'Address too short error', defaultValue: 'Please enter a valid address (minimum 10 characters)' },
  { id: 'property.error.descriptionTooShort', category: 'property', description: 'Description too short error', defaultValue: 'Please explain why this is a good space (minimum 20 characters)' },
  { id: 'property.error.uploadFailed', category: 'property', description: 'Upload failed error', defaultValue: 'Failed to upload property. Please try again.' },
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
    console.log('[ContentTab] handleSave called:', { id, editValue, category, description })
    try {
      await updateText(id, editValue, category, description)
      console.log('[ContentTab] Save successful')
      setEditingId(null)
    } catch (err) {
      console.error('[ContentTab] Save failed:', err)
    }
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
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                          e.preventDefault()
                          handleSave(entry.id, entry.category, entry.description)
                        } else if (e.key === 'Escape') {
                          e.preventDefault()
                          handleCancel()
                        }
                      }}
                      className="w-full bg-white/10 border border-indigo-500 rounded px-2 py-1 text-sm focus:outline-none min-h-[60px]"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleCancel}
                        className="text-xs px-2 py-1 text-gray-400 hover:text-white"
                      >
                        Cancel (Esc)
                      </button>
                      <button
                        onClick={() => {
                          console.log('[ContentTab] Save button clicked')
                          handleSave(entry.id, entry.category, entry.description)
                        }}
                        className="text-xs px-2 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-500"
                      >
                        Save (Ctrl+Enter)
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
