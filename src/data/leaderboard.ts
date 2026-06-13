import type { LeaderboardEntry } from './types'

export type LeaderboardScope = 'all' | 'day' | 'match'

/** The signed-in (or guest) player's own row — points come from real data. */
export type YouConfig = {
  username: string
  seed: string
  country: string
  points: number
  hits: number
}

/**
 * Merge the player into the field and re-rank everyone by points. A guest (or a
 * signed-in player who hasn't scored yet) sits at 0 points — i.e. last — until
 * the engine computes their real total.
 */
export function mergeYou(
  field: LeaderboardEntry[],
  you: YouConfig,
): LeaderboardEntry[] {
  const me: LeaderboardEntry = { id: 'me', rank: 0, ...you }
  const merged = [...field, me].sort((a, b) => b.points - a.points)
  return merged.map((e, i) => ({ ...e, rank: i + 1 }))
}
