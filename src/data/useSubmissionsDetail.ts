import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Outcome } from '../lib/scoring'

export type SubmissionGoalRow = {
  side: 'home' | 'away'
  bucket: number
  scorer_player_id: number | null
  assist_player_id: number | null
  seq: number | null
}

export type SubmissionRecord = {
  id: string
  attempt: number
  outcome: Outcome
  winner_goals: number | null
  loser_goals: number | null
  possession_home: number | null
  shots_home: number | null
  shots_away: number | null
  points: number
  created_at: string
  submission_goals: SubmissionGoalRow[]
}

/** All of a player's attempts for a match, with their goals, newest attempt last. */
export function useMySubmissions(
  matchId: string | undefined,
  email: string | null,
) {
  return useQuery({
    queryKey: ['my-submissions', matchId, email],
    enabled: !!email && !!matchId,
    queryFn: async (): Promise<SubmissionRecord[]> => {
      const { data, error } = await supabase
        .from('submissions')
        .select(
          'id, attempt, outcome, winner_goals, loser_goals, possession_home, shots_home, shots_away, points, created_at, submission_goals(side, bucket, scorer_player_id, assist_player_id, seq)',
        )
        .eq('email', email!)
        .eq('match_id', Number(matchId))
        .order('attempt', { ascending: true })
      if (error) throw error
      return (data as SubmissionRecord[]) ?? []
    },
  })
}

export type MatchResultRecord = {
  status: 'scheduled' | 'live' | 'finished'
  outcome: Outcome | null
  home_score: number
  away_score: number
  possession_home: number | null
  shots_home: number | null
  shots_away: number | null
}

/** The official result for a match, or null if none recorded yet. */
export function useMatchResult(matchId: string | undefined) {
  return useQuery({
    queryKey: ['match-result', matchId],
    enabled: !!matchId,
    queryFn: async (): Promise<MatchResultRecord | null> => {
      const { data, error } = await supabase
        .from('match_results')
        .select(
          'status, outcome, home_score, away_score, possession_home, shots_home, shots_away',
        )
        .eq('match_id', Number(matchId))
        .maybeSingle()
      if (error) throw error
      return (data as MatchResultRecord | null) ?? null
    },
  })
}
