import type { LeaderboardEntry } from './types'

export type LeaderboardScope = 'all' | 'day' | 'match'

// The signed-in player — placeholder until real scoring writes their row.
// Points differ per scope (season total vs today vs a single match).
const ME_POINTS: Record<LeaderboardScope, number> = { all: 78, day: 22, match: 24 }
const ME_HITS: Record<LeaderboardScope, number> = { all: 7, day: 2, match: 2 }

export function meEntry(scope: LeaderboardScope): LeaderboardEntry {
  return {
    id: 'me',
    rank: 0,
    username: 'You',
    country: 'mw',
    seed: 'Champion',
    points: ME_POINTS[scope],
    hits: ME_HITS[scope],
  }
}

/**
 * Merge the signed-in player into the field and re-rank everyone by points, so
 * "You" slots in naturally among the other players.
 */
export function mergeYou(
  field: LeaderboardEntry[],
  scope: LeaderboardScope,
): LeaderboardEntry[] {
  const merged = [...field, meEntry(scope)].sort((a, b) => b.points - a.points)
  return merged.map((e, i) => ({ ...e, rank: i + 1 }))
}
