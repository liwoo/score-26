import { supabase } from '../lib/supabase'
import { NO_ASSIST, OWN_GOAL } from '../features/prediction/PredictionContext'
import type { Match } from './types'

type PredictionState = {
  outcome: 'home' | 'away' | 'score-draw' | 'goalless-draw' | null
  winnerGoals: number | null
  loserGoals: number | null
  possessionHome: number
  shotsHome: number
  shotsAway: number
  goals: Array<{
    side: 'home' | 'away'
    bucket: number | null
    scorerId: string | null
    assistId: string | null
  }>
}

/** How many predictions this email has already submitted for a match. */
export async function getAttemptCount(
  email: string,
  matchId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from('submissions')
    .select('id', { count: 'exact', head: true })
    .eq('email', email)
    .eq('match_id', Number(matchId))
  if (error) throw error
  return count ?? 0
}

/** Counts per match for the signed-in player (for the Settings "My Sessions"). */
export async function getMyCounts(
  email: string,
): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('submissions')
    .select('match_id')
    .eq('email', email)
  if (error) throw error
  const counts: Record<string, number> = {}
  for (const row of data as { match_id: number }[]) {
    const key = String(row.match_id)
    counts[key] = (counts[key] ?? 0) + 1
  }
  return counts
}

/**
 * Persist a prediction as the next attempt for this email/match, writing the
 * submission row and its goal rows. Returns the attempt number (1–3).
 * RLS enforces that `email` matches the authenticated user.
 */
export async function saveSubmission(
  email: string,
  match: Match,
  state: PredictionState,
): Promise<number> {
  if (!state.outcome) throw new Error('Nothing to submit')

  const attempt = (await getAttemptCount(email, match.id)) + 1

  const winnerGoals =
    state.outcome === 'goalless-draw' ? null : state.winnerGoals
  const loserGoals =
    state.outcome === 'home' || state.outcome === 'away'
      ? state.loserGoals
      : null

  const { data: sub, error: subErr } = await supabase
    .from('submissions')
    .insert({
      email,
      match_id: Number(match.id),
      attempt,
      outcome: state.outcome,
      winner_goals: winnerGoals,
      loser_goals: loserGoals,
      possession_home:
        state.outcome === 'goalless-draw' ? state.possessionHome : null,
      shots_home: state.outcome === 'goalless-draw' ? state.shotsHome : null,
      shots_away: state.outcome === 'goalless-draw' ? state.shotsAway : null,
    })
    .select('id')
    .single()
  if (subErr) throw subErr

  const goalRows = state.goals
    .filter((g) => g.bucket != null && g.scorerId != null)
    .map((g, i) => {
      const ownGoal = g.scorerId === OWN_GOAL
      return {
        submission_id: (sub as { id: string }).id,
        side: g.side,
        bucket: g.bucket,
        scorer_player_id: ownGoal || !g.scorerId ? null : Number(g.scorerId),
        assist_player_id:
          ownGoal || !g.assistId || g.assistId === NO_ASSIST
            ? null
            : Number(g.assistId),
        own_goal: ownGoal,
        seq: i,
      }
    })

  if (goalRows.length > 0) {
    const { error: goalsErr } = await supabase
      .from('submission_goals')
      .insert(goalRows)
    if (goalsErr) throw goalsErr
  }

  return attempt
}
