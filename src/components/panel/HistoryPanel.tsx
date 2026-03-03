'use client'

import { useAuth } from '@/contexts/AuthContext'
import { HistoryTab } from './HistoryTab'
import { EditableText } from '@/components/EditableText'

export function HistoryPanel() {
  const { user, isAdmin } = useAuth()

  if (!user || !isAdmin) {
    return (
      <div className="p-4 text-center text-gray-400">
        <EditableText id="panel.admin.required" defaultValue="Admin access required" category="panel" />
      </div>
    )
  }

  return <HistoryTab />
}
