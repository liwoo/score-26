import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { LeaderboardEntry } from './types'
import type { LeaderboardScope } from './leaderboard'

export type { LeaderboardScope }

/** The signed-in player's own scoped totals (movement = rank change since last recompute). */
export type MyScore = {
  points: number
  hits: number
  games: number
  movement: number | null
}

type Row = {
  rank: number
  username: string
  country_iso: string | null
  avatar_seed: string | null
  points: number
  hits: number
  games: number
  prev_rank: number | null
}

function toEntry(r: Row, i: number): LeaderboardEntry {
  return {
    id: `${r.rank}-${i}`,
    rank: r.rank,
    username: r.username,
    country: r.country_iso ?? 'mw',
    seed: r.avatar_seed ?? r.username,
    points: r.points,
    hits: r.hits,
    games: r.games,
    // +ve = climbed; computed from the server rank so it stays correct even
    // after "You" is merged in client-side and the displayed rank shifts.
    movement: r.prev_rank == null ? null : r.prev_rank - r.rank,
  }
}

/**
 * Leaderboard leaders for a scope, read from the DB. For `match` scope, pass
 * the (static) match id. Standings change rarely until the engine recomputes,
 * so they're cached.
 */
export function useLeaderboard(
  scope: LeaderboardScope,
  matchId?: string,
  /** Exclude this player's own row — it's merged in client-side as "You". */
  excludeEmail?: string | null,
) {
  return useQuery({
    queryKey: ['leaderboard', scope, scope === 'match' ? matchId : null, excludeEmail],
    enabled: scope !== 'match' || !!matchId,
    staleTime: 60_000,
    queryFn: async (): Promise<LeaderboardEntry[]> => {
      let q = supabase
        .from('leaderboard')
        .select('rank, username, country_iso, avatar_seed, points, hits, games, prev_rank')
        .eq('scope', scope)
        .order('rank', { ascending: true })
      if (scope === 'match') q = q.eq('match_id', Number(matchId))
      // Keep the seeded (null-email) rows and every other player, drop only "you".
      if (excludeEmail) q = q.or(`email.is.null,email.neq.${excludeEmail}`)
      const { data, error } = await q
      if (error) throw error
      return (data as Row[]).map(toEntry)
    },
  })
}

/**
 * The signed-in player's own leaderboard row for a scope, by email. Returns
 * null until the engine has scored them (so the UI shows 0). Disabled when
 * signed out.
 */
export function useMyScore(
  scope: LeaderboardScope,
  matchId: string | undefined,
  email: string | null,
) {
  return useQuery({
    queryKey: ['my-score', scope, scope === 'match' ? matchId : null, email],
    enabled: !!email && (scope !== 'match' || !!matchId),
    queryFn: async (): Promise<MyScore | null> => {
      let q = supabase
        .from('leaderboard')
        .select('points, hits, games, rank, prev_rank')
        .eq('scope', scope)
        .eq('email', email!)
      if (scope === 'match') q = q.eq('match_id', Number(matchId))
      const { data, error } = await q.maybeSingle()
      if (error) throw error
      const r = data as {
        points: number
        hits: number
        games: number
        rank: number
        prev_rank: number | null
      } | null
      if (!r) return null
      return {
        points: r.points,
        hits: r.hits,
        games: r.games,
        movement: r.prev_rank == null ? null : r.prev_rank - r.rank,
      }
    },
  })
}

/** Match ids that have a leaderboard (i.e. matches that have been played). */
export function useLeaderboardMatchIds() {
  return useQuery({
    queryKey: ['leaderboard-match-ids'],
    staleTime: 60_000,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from('leaderboard')
        .select('match_id')
        .eq('scope', 'match')
        .not('match_id', 'is', null)
      if (error) throw error
      return [
        ...new Set((data as { match_id: number }[]).map((r) => String(r.match_id))),
      ]
    },
  })
}
