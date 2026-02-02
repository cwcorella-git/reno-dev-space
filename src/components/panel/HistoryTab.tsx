'use client'

import { useState, useEffect } from 'react'
import { subscribeToDeletions, DeletionEntry } from '@/lib/deletionStorage'
import { restoreBlock } from '@/lib/canvasStorage'
import { findOpenPosition } from '@/lib/overlapDetection'
import { useCanvas } from '@/contexts/CanvasContext'

const REASON_LABELS: Record<string, string> = {
  self: 'Self-deleted',
  admin: 'Admin removed',
  vote: 'Voted out',
  cascade: 'Account deleted',
}

const REASON_COLORS: Record<string, string> = {
  self: 'text-gray-400',
  admin: 'text-amber-400',
  vote: 'text-red-400',
  cascade: 'text-purple-400',
}

export function HistoryTab() {
  const { blocks } = useCanvas()
  const [entries, setEntries] = useState<DeletionEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('')
  const [restoringId, setRestoringId] = useState<string | null>(null)

  useEffect(() => {
    const unsub = subscribeToDeletions(
      (newEntries) => {
        setEntries(newEntries)
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
        {['self', 'admin', 'vote', 'cascade'].map((r) => {
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
                <button
                  onClick={() => handleRestore(entry)}
                  disabled={restoringId === entry.id}
                  className="text-[10px] px-2 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-500 disabled:opacity-50 shrink-0"
                >
                  {restoringId === entry.id ? '...' : 'Restore'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
