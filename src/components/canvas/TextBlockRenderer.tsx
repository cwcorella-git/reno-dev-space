'use client'

import { useRef, useEffect, useCallback } from 'react'
import { TextBlock } from '@/types/canvas'
import { useAuth } from '@/contexts/AuthContext'
import { voteOnBlock, removeBlockVote } from '@/lib/canvasStorage'

const PLACEHOLDER_TEXT = 'Click to edit'

interface TextBlockRendererProps {
  block: TextBlock
  isEditing: boolean
  onContentChange?: (content: string) => void
  onEditComplete?: () => void
}

export function TextBlockRenderer({
  block,
  isEditing,
  onContentChange,
  onEditComplete,
}: TextBlockRendererProps) {
  const { user } = useAuth()
  const editorRef = useRef<HTMLDivElement>(null)
  const isEmpty = !block.content || block.content.trim() === ''

  // Voting state
  const upvotes = block.upvotes || []
  const downvotes = block.downvotes || []
  const userVote = user
    ? upvotes.includes(user.uid)
      ? 'up'
      : downvotes.includes(user.uid)
        ? 'down'
        : null
    : null

  const handleVote = useCallback(
    async (voteType: 'up' | 'down', e: React.MouseEvent) => {
      e.stopPropagation()
      if (!user) return

      if (userVote === voteType) {
        // Remove vote if clicking same button
        await removeBlockVote(block.id, user.uid)
      } else {
        await voteOnBlock(block.id, user.uid, voteType)
      }
    },
    [user, userVote, block.id]
  )

  const style = {
    fontSize: `${block.style.fontSize}rem`,
    fontWeight: block.style.fontWeight,
    fontFamily: block.style.fontFamily || 'Inter',
    color: block.style.color,
    textAlign: block.style.textAlign as 'left' | 'center' | 'right',
    backgroundColor: block.style.backgroundColor || 'transparent',
  }

  // Focus and select all when entering edit mode
  useEffect(() => {
    if (isEditing && editorRef.current) {
      editorRef.current.focus()
      // Select all text if there's content
      if (block.content) {
        const selection = window.getSelection()
        const range = document.createRange()
        range.selectNodeContents(editorRef.current)
        selection?.removeAllRanges()
        selection?.addRange(range)
      }
    }
  }, [isEditing, block.content])

  if (isEditing) {
    return (
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        className="w-full h-full outline-none min-h-[1.5em] whitespace-pre-wrap break-words"
        style={style}
        onBlur={(e) => {
          const newContent = e.currentTarget.textContent || ''
          onContentChange?.(newContent.trim())
          onEditComplete?.()
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.currentTarget.blur()
          }
        }}
      >
        {block.content}
      </div>
    )
  }

  // Voting UI component
  const VotingUI = () => {
    if (!block.voteable) return null

    const netVotes = upvotes.length - downvotes.length

    return (
      <div className="flex items-center gap-3 mt-2 text-sm">
        <button
          onClick={(e) => handleVote('up', e)}
          className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${
            userVote === 'up'
              ? 'bg-green-600 text-white'
              : 'bg-white/10 hover:bg-white/20 text-gray-300'
          } ${!user ? 'opacity-50 cursor-not-allowed' : ''}`}
          disabled={!user}
          title={user ? 'Upvote' : 'Login to vote'}
        >
          <span>👍</span>
          <span>{upvotes.length}</span>
        </button>
        <button
          onClick={(e) => handleVote('down', e)}
          className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${
            userVote === 'down'
              ? 'bg-red-600 text-white'
              : 'bg-white/10 hover:bg-white/20 text-gray-300'
          } ${!user ? 'opacity-50 cursor-not-allowed' : ''}`}
          disabled={!user}
          title={user ? 'Downvote' : 'Login to vote'}
        >
          <span>👎</span>
          <span>{downvotes.length}</span>
        </button>
        <span className={`ml-1 font-medium ${netVotes > 0 ? 'text-green-400' : netVotes < 0 ? 'text-red-400' : 'text-gray-400'}`}>
          {netVotes > 0 ? '+' : ''}{netVotes}
        </span>
      </div>
    )
  }

  // Show placeholder if empty
  if (isEmpty) {
    return (
      <div>
        <div
          className="w-full whitespace-pre-wrap break-words opacity-40 italic"
          style={style}
        >
          {PLACEHOLDER_TEXT}
        </div>
        <VotingUI />
      </div>
    )
  }

  return (
    <div>
      <div
        className="w-full whitespace-pre-wrap break-words"
        style={style}
      >
        {block.content}
      </div>
      <VotingUI />
    </div>
  )
}
