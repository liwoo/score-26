import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { LeaderboardEntry } from './types'

export type LeaderboardScope = 'all' | 'day' | 'match'

type Row = {
  rank: number
  username: string
  country_iso: string | null
  avatar_seed: string | null
  points: number
  hits: number
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
  }
}

/**
 * Leaderboard leaders for a scope, read from the DB. For `match` scope, pass
 * the (static) match id. Standings change rarely until the engine recomputes,
 * so they're cached.
 */
export function useLeaderboard(scope: LeaderboardScope, matchId?: string) {
  return useQuery({
    queryKey: ['leaderboard', scope, scope === 'match' ? matchId : null],
    enabled: scope !== 'match' || !!matchId,
    staleTime: 60_000,
    queryFn: async (): Promise<LeaderboardEntry[]> => {
      let q = supabase
        .from('leaderboard')
        .select('rank, username, country_iso, avatar_seed, points, hits')
        .eq('scope', scope)
        .order('rank', { ascending: true })
      if (scope === 'match') q = q.eq('match_id', Number(matchId))
      const { data, error } = await q
      if (error) throw error
      return (data as Row[]).map(toEntry)
    },
  })
}
