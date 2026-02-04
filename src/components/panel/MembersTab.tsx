'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { subscribeToUsers, getUserStats, UserProfile, UserStats, adminDeleteUser } from '@/lib/storage/userStorage'
import { addAdmin, removeAdmin } from '@/lib/storage/adminStorage'
import { subscribeToBannedEmails, banEmail, unbanEmail } from '@/lib/storage/bannedEmailsStorage'
import { SUPER_ADMIN_EMAIL } from '@/lib/admin'
import { EditableText } from '../EditableText'

interface UserWithStats extends UserProfile {
  stats?: UserStats
}

type ConfirmAction = { uid: string; type: 'promote' | 'delete' | 'ban' }

export function MembersTab() {
  const { user, isAdmin, adminEmails } = useAuth()
  const [users, setUsers] = useState<UserWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)
  const [bannedEmails, setBannedEmails] = useState<Set<string>>(new Set())
  const [actionLoading, setActionLoading] = useState(false)

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

    const unsubBanned = subscribeToBannedEmails((emails) => setBannedEmails(emails))

    return () => {
      unsubUsers()
      unsubBanned()
    }
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
            <th className="px-3 py-2 font-medium"><EditableText id="members.header.name" defaultValue="Name" category="members" /></th>
            <th className="px-3 py-2 font-medium text-center"><EditableText id="members.header.blocks" defaultValue="Blocks" category="members" /></th>
            <th className="px-3 py-2 font-medium text-center"><EditableText id="members.header.votes" defaultValue="Votes" category="members" /></th>
            <th className="px-3 py-2 font-medium text-right"><EditableText id="members.header.pledge" defaultValue="Pledge" category="members" /></th>
            <th className="px-3 py-2 font-medium text-right"><EditableText id="members.header.joined" defaultValue="Joined" category="members" /></th>
            {isAdmin && <th className="px-3 py-2 font-medium text-center w-10"></th>}
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
                        <EditableText id="members.badge.you" defaultValue="you" category="members" />
                      </span>
                    )}
                    {hasPledge && !isCurrentUser && (
                      <span className="text-[10px] bg-emerald-600/50 px-1.5 py-0.5 rounded text-emerald-200">
                        <EditableText id="members.badge.backer" defaultValue="backer" category="members" />
                      </span>
                    )}
                    {adminEmails.has(u.email.toLowerCase()) || u.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase() ? (
                      <span className="text-[10px] bg-amber-600/50 px-1.5 py-0.5 rounded text-amber-200">
                        <EditableText id="members.badge.admin" defaultValue="admin" category="members" />
                      </span>
                    ) : null}
                    {bannedEmails.has(u.email.toLowerCase()) && (
                      <span className="text-[10px] bg-red-600/50 px-1.5 py-0.5 rounded text-red-200">
                        <EditableText id="members.badge.banned" defaultValue="banned" category="members" />
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
                {isAdmin && (
                  <td className="px-3 py-2">
                    {u.email.toLowerCase() !== SUPER_ADMIN_EMAIL.toLowerCase() && u.uid !== user?.uid && (
                      confirmAction?.uid === u.uid ? (
                        <div className="flex items-center gap-1 justify-end">
                          <span className="text-[9px] text-gray-400 mr-1">
                            {confirmAction.type === 'promote' && (adminEmails.has(u.email.toLowerCase()) ? 'Demote?' : 'Promote?')}
                            {confirmAction.type === 'delete' && 'Delete?'}
                            {confirmAction.type === 'ban' && (bannedEmails.has(u.email.toLowerCase()) ? 'Unban?' : 'Ban?')}
                          </span>
                          <button
                            disabled={actionLoading}
                            onClick={async () => {
                              setActionLoading(true)
                              try {
                                if (confirmAction.type === 'promote') {
                                  const isUserAdmin = adminEmails.has(u.email.toLowerCase())
                                  if (isUserAdmin) await removeAdmin(u.email)
                                  else await addAdmin(u.email)
                                } else if (confirmAction.type === 'delete') {
                                  await adminDeleteUser(u.uid)
                                } else if (confirmAction.type === 'ban') {
                                  const isBanned = bannedEmails.has(u.email.toLowerCase())
                                  if (isBanned) await unbanEmail(u.email)
                                  else await banEmail(u.email, user?.uid || 'admin')
                                }
                              } catch (err) {
                                console.error('Action failed:', err)
                              }
                              setActionLoading(false)
                              setConfirmAction(null)
                            }}
                            className="text-[10px] px-1.5 py-0.5 bg-amber-600 text-white rounded hover:bg-amber-500 disabled:opacity-50"
                          >
                            ✓
                          </button>
                          <button
                            onClick={() => setConfirmAction(null)}
                            className="text-[10px] px-1.5 py-0.5 text-gray-400 hover:text-white"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-0.5 justify-end">
                          {/* Promote/Demote */}
                          <button
                            onClick={() => setConfirmAction({ uid: u.uid, type: 'promote' })}
                            className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${
                              adminEmails.has(u.email.toLowerCase())
                                ? 'text-amber-400 hover:text-amber-200 hover:bg-amber-600/20'
                                : 'text-gray-600 hover:text-gray-400 hover:bg-white/5'
                            }`}
                            title={adminEmails.has(u.email.toLowerCase()) ? 'Remove admin' : 'Make admin'}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                          </button>
                          {/* Delete */}
                          <button
                            onClick={() => setConfirmAction({ uid: u.uid, type: 'delete' })}
                            className="w-6 h-6 rounded flex items-center justify-center text-gray-600 hover:text-red-400 hover:bg-red-600/10 transition-colors"
                            title="Delete user"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                          {/* Ban/Unban */}
                          <button
                            onClick={() => setConfirmAction({ uid: u.uid, type: 'ban' })}
                            className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${
                              bannedEmails.has(u.email.toLowerCase())
                                ? 'text-red-400 hover:text-red-200 hover:bg-red-600/20'
                                : 'text-gray-600 hover:text-red-400 hover:bg-red-600/10'
                            }`}
                            title={bannedEmails.has(u.email.toLowerCase()) ? 'Unban email' : 'Ban email'}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                            </svg>
                          </button>
                        </div>
                      )
                    )}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
