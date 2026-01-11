'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { subscribeToUsers, getUserStats, UserProfile, UserStats } from '@/lib/userStorage'
import { EditableText } from '../EditableText'

interface UserWithStats extends UserProfile {
  stats?: UserStats
}

export function MembersTab() {
  const { user } = useAuth()
  const [users, setUsers] = useState<UserWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const unsubUsers = subscribeToUsers(
      async (newUsers) => {
        console.log('[MembersTab] Received users:', newUsers.length)
        // Fetch stats for each user
        const usersWithStats = await Promise.all(
          newUsers.map(async (u) => {
            try {
              const stats = await getUserStats(u.uid)
              return { ...u, stats }
            } catch {
              return { ...u, stats: { blocksCreated: 0, votesGiven: 0, pledgeAmount: 0 } }
            }
          })
        )
        // Sort by pledge amount descending
        usersWithStats.sort((a, b) => (b.stats?.pledgeAmount || 0) - (a.stats?.pledgeAmount || 0))
        setUsers(usersWithStats)
        setLoading(false)
        setError(null)
      },
      (err) => {
        console.error('[MembersTab] Error:', err)
        setError(err.message)
        setLoading(false)
      }
    )

    return () => unsubUsers()
  }, [])

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  if (loading) {
    return (
      <div className="px-4 py-6 text-center text-gray-500 text-sm">
        <EditableText
          id="panel.members.loading"
          defaultValue="Loading members..."
          category="panel"
        />
      </div>
    )
  }

  if (error) {
    return (
      <div className="px-4 py-6 text-center text-red-400 text-sm">
        <EditableText
          id="panel.members.error"
          defaultValue="Error loading members:"
          category="panel"
        />{' '}{error}
      </div>
    )
  }

  if (users.length === 0) {
    return (
      <div className="px-4 py-6 text-center text-gray-500 text-sm">
        <EditableText
          id="panel.members.empty"
          defaultValue="No members yet. Be the first to join!"
          category="panel"
        />
        {user && (
          <EditableText
            id="panel.members.emptyHint"
            defaultValue="(You're signed in but your profile may not be in the database yet)"
            category="panel"
            as="p"
            className="mt-2 text-xs text-gray-600"
          />
        )}
      </div>
    )
  }

  return (
    <div className="max-h-[300px] overflow-y-auto">
      <table className="w-full text-sm">
        <thead className="bg-white/5 sticky top-0">
          <tr className="text-left text-gray-400">
            <th className="px-3 py-2 font-medium">Name</th>
            <th className="px-3 py-2 font-medium text-center">Blocks</th>
            <th className="px-3 py-2 font-medium text-center">Votes</th>
            <th className="px-3 py-2 font-medium text-right">Pledge</th>
            <th className="px-3 py-2 font-medium text-right">Joined</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {users.map((u) => {
            const isCurrentUser = u.uid === user?.uid
            const hasPledge = (u.stats?.pledgeAmount || 0) > 0
            return (
              <tr
                key={u.uid}
                className={`${isCurrentUser ? 'bg-indigo-600/20 text-white' : hasPledge ? 'text-white hover:bg-white/5' : 'text-gray-500 hover:bg-white/5'}`}
              >
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className={`font-medium truncate max-w-[100px] ${!hasPledge && !isCurrentUser ? 'text-gray-400' : ''}`}>
                      {u.displayName}
                    </span>
                    {isCurrentUser && (
                      <span className="text-[10px] bg-indigo-600 px-1.5 py-0.5 rounded text-white">
                        you
                      </span>
                    )}
                    {hasPledge && !isCurrentUser && (
                      <span className="text-[10px] bg-emerald-600/50 px-1.5 py-0.5 rounded text-emerald-200">
                        backer
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2 text-center text-gray-300">
                  {u.stats?.blocksCreated || 0}
                </td>
                <td className="px-3 py-2 text-center text-gray-300">
                  {u.stats?.votesGiven || 0}
                </td>
                <td className="px-3 py-2 text-right text-gray-300">
                  {u.stats?.pledgeAmount ? `$${u.stats.pledgeAmount}` : '-'}
                </td>
                <td className="px-3 py-2 text-right text-gray-400">
                  {u.createdAt ? formatDate(u.createdAt) : '-'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
