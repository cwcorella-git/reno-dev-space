/**
 * Derives the current voter state for a given user from the three voter arrays
 * shared by both CanvasBlock and RentalProperty schemas.
 */
export function deriveVoterState(
  votersUp: string[] | undefined,
  votersDown: string[] | undefined,
  voters: string[] | undefined,
  userId: string
) {
  const votedUp = votersUp?.includes(userId) ?? false
  const votedDown = votersDown?.includes(userId) ?? false
  const isLegacyVoter = (voters?.includes(userId) ?? false) && !votedUp && !votedDown
  const hasVoted = votedUp || votedDown || isLegacyVoter
  return { votedUp, votedDown, isLegacyVoter, hasVoted }
}
