'use client'

import { useAuth } from '@/contexts/AuthContext'
import { ContentTab } from './ContentTab'

export function ContentPanel() {
  const { user, isAdmin } = useAuth()

  if (!user || !isAdmin) {
    return (
      <div className="p-4 text-center text-gray-400">
        Admin access required
      </div>
    )
  }

  return <ContentTab />
}
