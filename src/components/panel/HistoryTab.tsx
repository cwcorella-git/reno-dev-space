'use client'

import { useState, useEffect, useCallback } from 'react'
import { subscribeToDeletions, deleteHistoryEntry, DeletionEntry } from '@/lib/storage/deletionStorage'
import { subscribeToBlockEdits, EditHistoryEntry } from '@/lib/storage/editHistoryStorage'
import { restoreBlock } from '@/lib/storage/canvasStorage'
import { findOpenPosition } from '@/lib/overlapDetection'
import { useCanvas } from '@/contexts/CanvasContext'

const REASON_LABELS: Record<string, string> = {
  self: 'Self-deleted',
  admin: 'Admin removed',
  vote: 'Voted out',
  cascade: 'Account deleted',
  report: 'Reported',
}

const REASON_COLORS: Record<string, string> = {
  self: 'text-gray-400',
  admin: 'text-amber-400',
  vote: 'text-red-400',
  cascade: 'text-purple-400',
  report: 'text-orange-400',
}

export function HistoryTab() {
  const { blocks } = useCanvas()
  const [entries, setEntries] = useState<DeletionEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('')
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [expandedEditId, setExpandedEditId] = useState<string | null>(null)
  const [editHistory, setEditHistory] = useState<EditHistoryEntry[]>([])
  const [editHistoryLoading, setEditHistoryLoading] = useState(false)

  // Subscribe to block edits when an entry is expanded
  useEffect(() => {
    if (!expandedEditId) {
      setEditHistory([])
      return
    }
    const entry = entries.find((e) => e.id === expandedEditId)
    if (!entry) return
    setEditHistoryLoading(true)
    const unsub = subscribeToBlockEdits(
      entry.originalId,
      (edits) => { setEditHistory(edits); setEditHistoryLoading(false) },
      () => setEditHistoryLoading(false)
    )
    return unsub
  }, [expandedEditId, entries])

  const renderEditHistory = useCallback(() => {
    if (editHistoryLoading) {
      return <div className="text-[10px] text-gray-500 pt-2">Loading edits...</div>
    }
    if (editHistory.length === 0) {
      return <div className="text-[10px] text-gray-500 pt-2">No edit history recorded.</div>
    }
    return (
      <div className="mt-2 border-t border-white/10 pt-2 max-h-32 overflow-y-auto space-y-1">
        <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">Previous versions</div>
        {editHistory.map((edit) => (
          <div key={edit.id} className="flex items-start gap-2 text-[10px] py-1 border-b border-white/5 last:border-0">
            <span className="text-gray-500 shrink-0 w-24">{formatTime(edit.editedAt)}</span>
            <span className="text-gray-300 truncate flex-1">{edit.content}</span>
          </div>
        ))}
      </div>
    )
  }, [editHistory, editHistoryLoading])

  useEffect(() => {
    const unsub = subscribeToDeletions(
      (newEntries) => {
        setEntries(newEntries.filter((e) => e.block.content?.trim()))
        setLoading(false)
      },
      () => setLoading(false)
    )
    return unsub
  }, [])

  const handleRestore = async (entry: DeletionEntry) => {
    setRestoringId(entry.id)
    try {
      const { x, y } = findOpenPosition(
        entry.block.x,
        entry.block.y,
        entry.block.width || 20,
        blocks
      )
      await restoreBlock({ ...entry.block, x, y })
    } catch (err) {
      console.error('[HistoryTab] Restore failed:', err)
    }
    setRestoringId(null)
  }

  const handleDelete = async (entryId: string) => {
    setDeletingId(entryId)
    try {
      await deleteHistoryEntry(entryId)
    } catch (err) {
      console.error('[HistoryTab] Delete failed:', err)
    }
    setDeletingId(null)
  }

  const formatTime = (ts: number) => {
    const d = new Date(ts)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
      ' ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }

  const filtered = filter
    ? entries.filter((e) => e.reason === filter)
    : entries

  if (loading) {
    return <div className="p-4 text-center text-gray-500 text-sm">Loading history...</div>
  }

  return (
    <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto">
      {/* Filter buttons */}
      <div className="flex gap-1 flex-wrap">
        <button
          onClick={() => setFilter('')}
          className={`text-[10px] px-2 py-0.5 rounded ${!filter ? 'bg-white/20 text-white' : 'text-gray-400 hover:text-white'}`}
        >
          All ({entries.length})
        </button>
        {['self', 'admin', 'vote', 'cascade', 'report'].map((r) => {
          const count = entries.filter((e) => e.reason === r).length
          if (count === 0) return null
          return (
            <button
              key={r}
              onClick={() => setFilter(filter === r ? '' : r)}
              className={`text-[10px] px-2 py-0.5 rounded ${filter === r ? 'bg-white/20 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              {REASON_LABELS[r]} ({count})
            </button>
          )
        })}
      </div>

      {/* Entries */}
      {filtered.length === 0 ? (
        <p className="text-center text-gray-500 text-sm py-4">
          {entries.length === 0 ? 'No deletions yet.' : 'No matches for this filter.'}
        </p>
      ) : (
        <div className="space-y-1">
          {filtered.map((entry) => (
            <div key={entry.id} className="bg-white/5 rounded-lg p-3 space-y-1">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-200 truncate">
                    {entry.block.content || '(empty block)'}
                  </p>
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className={REASON_COLORS[entry.reason] || 'text-gray-400'}>
                      {REASON_LABELS[entry.reason] || entry.reason}
                    </span>
                    <span className="text-gray-600">{formatTime(entry.deletedAt)}</span>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  {entry.reason !== 'report' && (
                    <button
                      onClick={() => setExpandedEditId(expandedEditId === entry.id ? null : entry.id)}
                      className={`text-[10px] px-2 py-1 rounded shrink-0 ${
                        expandedEditId === entry.id ? 'bg-white/20 text-white' : 'bg-white/5 text-gray-400 hover:text-white'
                      }`}
                      title="View edit history"
                    >
                      Edits
                    </button>
                  )}
                  {entry.reason !== 'report' && (
                    <button
                      onClick={() => handleRestore(entry)}
                      disabled={restoringId === entry.id}
                      className="text-[10px] px-2 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-500 disabled:opacity-50 shrink-0"
                    >
                      {restoringId === entry.id ? '...' : 'Restore'}
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(entry.id)}
                    disabled={deletingId === entry.id}
                    className="text-[10px] px-2 py-1 bg-white/5 text-gray-400 hover:text-red-400 hover:bg-red-600/10 rounded disabled:opacity-50 shrink-0"
                    title="Delete from history"
                  >
                    {deletingId === entry.id ? '...' : '✕'}
                  </button>
                </div>
              </div>
              {expandedEditId === entry.id && renderEditHistory()}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
