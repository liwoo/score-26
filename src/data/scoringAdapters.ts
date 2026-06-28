import type { GoalFact, MatchResult, Outcome, Prediction } from '../lib/scoring'

/** A submissions row (the columns the engine needs). */
export type SubmissionRow = {
  outcome: Outcome
  winner_goals: number | null
  loser_goals: number | null
  possession_home: number | null
  shots_home: number | null
  shots_away: number | null
  /** Predicted penalty shootout winner (knockout draws only). */
  penalty_winner: 'home' | 'away' | null
}

export type GoalRow = {
  side: 'home' | 'away'
  bucket: number
  scorer_player_id: number | null
  assist_player_id: number | null
  own_goal?: boolean | null
}

export type ResultRow = {
  outcome: Outcome
  home_score: number
  away_score: number
  possession_home: number | null
  shots_home: number | null
  shots_away: number | null
  /** Actual penalty shootout winner, or null if the match didn't go to penalties. */
  penalty_winner: 'home' | 'away' | null
}

const toGoal = (r: GoalRow): GoalFact => ({
  side: r.side,
  bucket: r.bucket,
  scorerId: r.scorer_player_id,
  assistId: r.assist_player_id,
  ownGoal: !!r.own_goal,
})

/** Derive home/away scores from outcome + winner/loser goals. */
function scoresFromOutcome(s: SubmissionRow): { home: number; away: number } {
  const w = s.winner_goals ?? 0
  const l = s.loser_goals ?? 0
  switch (s.outcome) {
    case 'home':
      return { home: w, away: l }
    case 'away':
      return { home: l, away: w }
    case 'score-draw':
      return { home: w, away: w }
    case 'goalless-draw':
      return { home: 0, away: 0 }
  }
}

export function predictionFromSubmission(
  sub: SubmissionRow,
  goals: GoalRow[],
): Prediction {
  const { home, away } = scoresFromOutcome(sub)
  return {
    outcome: sub.outcome,
    homeScore: home,
    awayScore: away,
    goals: goals.map(toGoal),
    possessionHome: sub.possession_home,
    shotsHome: sub.shots_home,
    shotsAway: sub.shots_away,
    penaltyWinner: sub.penalty_winner ?? null,
  }
}

export function resultFromRows(res: ResultRow, goals: GoalRow[]): MatchResult {
  return {
    outcome: res.outcome,
    homeScore: res.home_score,
    awayScore: res.away_score,
    goals: goals.map(toGoal),
    possessionHome: res.possession_home ?? 50,
    shotsHome: res.shots_home ?? 0,
    shotsAway: res.shots_away ?? 0,
    penaltyWinner: res.penalty_winner ?? null,
  }
}
