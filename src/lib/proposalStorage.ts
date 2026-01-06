import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDocs,
  query,
  where,
  orderBy,
  arrayUnion,
  arrayRemove,
  onSnapshot,
} from 'firebase/firestore'
import { getDb } from './firebase'

export type ProposalType = 'name' | 'value' | 'idea'
export type ProposalStatus = 'active' | 'passed' | 'rejected' | 'expired'

export interface Proposal {
  id: string
  type: ProposalType
  title: string
  description?: string
  proposedBy: string
  proposedByName: string
  upvotes: string[]
  downvotes: string[]
  status: ProposalStatus
  createdAt: number
  expiresAt: number
}

const PROPOSALS_COLLECTION = 'proposals'
const EXPIRY_DAYS = 14
const PASS_THRESHOLD = 5 // Net votes needed to pass
const REJECT_THRESHOLD = -3 // Net votes to reject

// Create a new proposal
export async function createProposal(
  type: ProposalType,
  title: string,
  description: string,
  userId: string,
  userName: string
): Promise<string> {
  const now = Date.now()
  const expiresAt = now + EXPIRY_DAYS * 24 * 60 * 60 * 1000

  const proposal = {
    type,
    title,
    description,
    proposedBy: userId,
    proposedByName: userName,
    upvotes: [userId], // Proposer auto-upvotes
    downvotes: [],
    status: 'active' as ProposalStatus,
    createdAt: now,
    expiresAt,
  }

  const db = getDb()
  const docRef = await addDoc(collection(db, PROPOSALS_COLLECTION), proposal)
  return docRef.id
}

// Get all proposals (with optional type filter)
export async function getProposals(type?: ProposalType): Promise<Proposal[]> {
  const db = getDb()
  let q = query(
    collection(db, PROPOSALS_COLLECTION),
    orderBy('createdAt', 'desc')
  )

  if (type) {
    q = query(
      collection(db, PROPOSALS_COLLECTION),
      where('type', '==', type),
      orderBy('createdAt', 'desc')
    )
  }

  const snapshot = await getDocs(q)
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Proposal[]
}

// Get active proposals
export async function getActiveProposals(type?: ProposalType): Promise<Proposal[]> {
  const proposals = await getProposals(type)
  const now = Date.now()

  return proposals.filter((p) => {
    // Check if expired
    if (p.expiresAt < now && p.status === 'active') {
      // Mark as expired (async, don't wait)
      updateProposalStatus(p.id, 'expired')
      return false
    }
    return p.status === 'active'
  })
}

// Subscribe to proposals (real-time updates)
export function subscribeToProposals(
  callback: (proposals: Proposal[]) => void,
  type?: ProposalType
) {
  // Return early on server side
  if (typeof window === 'undefined') {
    return () => {}
  }

  const db = getDb()
  let q = query(
    collection(db, PROPOSALS_COLLECTION),
    orderBy('createdAt', 'desc')
  )

  if (type) {
    q = query(
      collection(db, PROPOSALS_COLLECTION),
      where('type', '==', type),
      orderBy('createdAt', 'desc')
    )
  }

  return onSnapshot(q, (snapshot) => {
    const proposals = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Proposal[]
    callback(proposals)
  })
}

// Vote on a proposal
export async function voteOnProposal(
  proposalId: string,
  userId: string,
  vote: 'up' | 'down'
): Promise<void> {
  const db = getDb()
  const proposalRef = doc(db, PROPOSALS_COLLECTION, proposalId)

  if (vote === 'up') {
    await updateDoc(proposalRef, {
      upvotes: arrayUnion(userId),
      downvotes: arrayRemove(userId),
    })
  } else {
    await updateDoc(proposalRef, {
      downvotes: arrayUnion(userId),
      upvotes: arrayRemove(userId),
    })
  }

  // Check thresholds and update status
  await checkAndUpdateStatus(proposalId)
}

// Remove vote
export async function removeVote(proposalId: string, userId: string): Promise<void> {
  const db = getDb()
  const proposalRef = doc(db, PROPOSALS_COLLECTION, proposalId)
  await updateDoc(proposalRef, {
    upvotes: arrayRemove(userId),
    downvotes: arrayRemove(userId),
  })
}

// Check vote thresholds and update status
async function checkAndUpdateStatus(proposalId: string): Promise<void> {
  const proposals = await getProposals()
  const proposal = proposals.find((p) => p.id === proposalId)

  if (!proposal || proposal.status !== 'active') return

  const netVotes = proposal.upvotes.length - proposal.downvotes.length

  if (netVotes >= PASS_THRESHOLD) {
    await updateProposalStatus(proposalId, 'passed')
  } else if (netVotes <= REJECT_THRESHOLD) {
    await updateProposalStatus(proposalId, 'rejected')
  }
}

// Update proposal status
export async function updateProposalStatus(
  proposalId: string,
  status: ProposalStatus
): Promise<void> {
  const db = getDb()
  const proposalRef = doc(db, PROPOSALS_COLLECTION, proposalId)
  await updateDoc(proposalRef, { status })
}

// Get user's vote on a proposal
export function getUserVote(proposal: Proposal, userId: string): 'up' | 'down' | null {
  if (proposal.upvotes.includes(userId)) return 'up'
  if (proposal.downvotes.includes(userId)) return 'down'
  return null
}

// Get net votes
export function getNetVotes(proposal: Proposal): number {
  return proposal.upvotes.length - proposal.downvotes.length
}

// Format time remaining
export function formatTimeRemaining(expiresAt: number): string {
  const remaining = expiresAt - Date.now()

  if (remaining <= 0) return 'Expired'

  const days = Math.floor(remaining / (1000 * 60 * 60 * 24))
  const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))

  if (days > 0) return `${days}d ${hours}h remaining`
  if (hours > 0) return `${hours}h remaining`
  return 'Less than 1h remaining'
}
