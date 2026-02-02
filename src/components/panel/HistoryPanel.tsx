'use client'

import { useAuth } from '@/contexts/AuthContext'
import { HistoryTab } from './HistoryTab'

export function HistoryPanel() {
  const { user, isAdmin } = useAuth()

  if (!user || !isAdmin) {
    return (
      <div className="p-4 text-center text-gray-400">
        Admin access required
      </div>
    )
  }

  return <HistoryTab />
}
