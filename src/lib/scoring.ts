/**
 * Score26 scoring engine — pure & dependency-free so it can run in the app, a
 * Node/Bun script, or a Supabase edge function without modification.
 *
 * Rubric (per submission, scored against the final match result):
 *   • Correct outcome (W/L/score-draw/goalless), any score ........... 5
 *   • Correct total number of goals in the match .................... 3
 *   • Correct goal distribution, ignoring which side (e.g. 2–0≡0–2) .. 5
 *   • Exact scoreline (correct distribution AND sides) .............. 10
 *   • Each goal predicted in the correct time bracket (per side) ..... 5
 *   • Each goal's scorer predicted correctly ........................ 5
 *   • Each goal's assister predicted correctly ...................... 5
 *   • Possession within 5 percentage points ........................ 10
 *   • Possession within 10 percentage points (tier, else) ........... 5
 *   • Total shots within 2, per team ................................ 7
 *   • Total shots within 4, per team (tier, else) ................... 5
 *   • Perfect prediction (everything maxed) — bonus ................ 50
 *
 * Possession & shots are only predicted for a goalless-draw call, so those
 * points are only attainable on a goalless-draw submission.
 */

export type Outcome = 'home' | 'away' | 'score-draw' | 'goalless-draw'

export type GoalFact = {
  side: 'home' | 'away'
  /** Timeline bracket 0–9 (0–10', …, 90'+). */
  bucket: number
  /** Player id, or null. */
  scorerId: number | null
  /** Player id, null = no assist (solo goal). */
  assistId: number | null
}

export type Prediction = {
  outcome: Outcome
  homeScore: number
  awayScore: number
  goals: GoalFact[]
  /** Goalless-draw only. */
  possessionHome?: number | null
  shotsHome?: number | null
  shotsAway?: number | null
}

export type MatchResult = {
  outcome: Outcome
  homeScore: number
  awayScore: number
  goals: GoalFact[]
  possessionHome: number
  shotsHome: number
  shotsAway: number
}

export type ScoreLine = { key: string; label: string; points: number }
export type ScoreBreakdown = { total: number; lines: ScoreLine[] }

export const POINTS = {
  outcome: 5,
  goalCount: 3,
  distribution: 5,
  exactScore: 10,
  goalTiming: 5,
  goalScorer: 5,
  goalAssister: 5,
  possessionTight: 10, // within 5 pts
  possessionClose: 5, // within 10 pts
  shotsTight: 7, // within 2 (per team)
  shotsClose: 5, // within 4 (per team)
  perfect: 50,
} as const

const sortedPair = (a: number, b: number) => (a <= b ? [a, b] : [b, a])

type Components = { timing: number; scorer: number; assister: number }

/** Value of pairing one predicted goal with one actual goal (same side). */
function pairValue(p: GoalFact, a: GoalFact): Components {
  return {
    timing: p.bucket === a.bucket ? POINTS.goalTiming : 0,
    scorer:
      p.scorerId != null && p.scorerId === a.scorerId ? POINTS.goalScorer : 0,
    // Assist points require a real assister that was named correctly.
    assister:
      a.assistId != null && p.assistId === a.assistId ? POINTS.goalAssister : 0,
  }
}

/**
 * Best one-to-one assignment of predicted→actual goals (same side) maximising
 * total component points. Small N (goals per side), so exact DP over a bitmask
 * of used actual goals is fine.
 */
function matchSide(preds: GoalFact[], actuals: GoalFact[]): Components {
  const memo = new Map<string, Components & { total: number }>()
  const value = (c: Components) => c.timing + c.scorer + c.assister

  function go(i: number, used: number): Components & { total: number } {
    if (i === preds.length) return { timing: 0, scorer: 0, assister: 0, total: 0 }
    const key = `${i}|${used}`
    const cached = memo.get(key)
    if (cached) return cached

    // Option: leave predicted goal i unmatched.
    let best = go(i + 1, used)
    // Option: match predicted goal i to an unused actual goal j.
    for (let j = 0; j < actuals.length; j++) {
      if (used & (1 << j)) continue
      const v = pairValue(preds[i], actuals[j])
      const rest = go(i + 1, used | (1 << j))
      const cand = {
        timing: v.timing + rest.timing,
        scorer: v.scorer + rest.scorer,
        assister: v.assister + rest.assister,
        total: value(v) + rest.total,
      }
      if (cand.total > best.total) best = cand
    }
    memo.set(key, best)
    return best
  }

  const r = go(0, 0)
  return { timing: r.timing, scorer: r.scorer, assister: r.assister }
}

/** Canonical key for a goal, for exact-match (perfect) comparison. */
const goalKey = (g: GoalFact) => `${g.bucket}:${g.scorerId ?? 'x'}:${g.assistId ?? 'x'}`

function goalsIdentical(a: GoalFact[], b: GoalFact[]): boolean {
  if (a.length !== b.length) return false
  const ka = a.map(goalKey).sort()
  const kb = b.map(goalKey).sort()
  return ka.every((k, i) => k === kb[i])
}

export function scoreSubmission(
  pred: Prediction,
  result: MatchResult,
): ScoreBreakdown {
  const lines: ScoreLine[] = []
  const add = (key: string, label: string, points: number) => {
    if (points > 0) lines.push({ key, label, points })
  }

  // 1. Outcome
  if (pred.outcome === result.outcome)
    add('outcome', 'Correct outcome', POINTS.outcome)

  // 2. Total goal count
  const predTotal = pred.homeScore + pred.awayScore
  const resTotal = result.homeScore + result.awayScore
  if (predTotal === resTotal)
    add('goalCount', 'Correct number of goals', POINTS.goalCount)

  // 3. Distribution (unordered) & 4. exact scoreline (ordered)
  const [ph, pa] = sortedPair(pred.homeScore, pred.awayScore)
  const [rh, ra] = sortedPair(result.homeScore, result.awayScore)
  if (ph === rh && pa === ra)
    add('distribution', 'Correct goal distribution', POINTS.distribution)
  const exact =
    pred.homeScore === result.homeScore && pred.awayScore === result.awayScore
  if (exact) add('exactScore', 'Exact scoreline', POINTS.exactScore)

  // 5–7. Goal timing / scorer / assister, matched per side
  let goalsPerfect = true
  for (const side of ['home', 'away'] as const) {
    const p = pred.goals.filter((g) => g.side === side)
    const a = result.goals.filter((g) => g.side === side)
    const c = matchSide(p, a)
    if (c.timing)
      add(`timing-${side}`, `Goal timing ×${c.timing / POINTS.goalTiming} (${side})`, c.timing)
    if (c.scorer)
      add(`scorer-${side}`, `Goal scorer ×${c.scorer / POINTS.goalScorer} (${side})`, c.scorer)
    if (c.assister)
      add(`assist-${side}`, `Goal assist ×${c.assister / POINTS.goalAssister} (${side})`, c.assister)
    if (!goalsIdentical(p, a)) goalsPerfect = false
  }

  // 8. Possession & 9. shots — only when the player called a goalless draw.
  let statsPerfect = true
  if (pred.outcome === 'goalless-draw' && pred.possessionHome != null) {
    const diff = Math.abs(pred.possessionHome - result.possessionHome)
    if (diff <= 5) add('possession', 'Possession within 5%', POINTS.possessionTight)
    else if (diff <= 10) add('possession', 'Possession within 10%', POINTS.possessionClose)
    if (diff > 5) statsPerfect = false

    const teams: Array<['home' | 'away', number | null | undefined, number]> = [
      ['home', pred.shotsHome, result.shotsHome],
      ['away', pred.shotsAway, result.shotsAway],
    ]
    for (const [side, predShots, resShots] of teams) {
      if (predShots == null) {
        statsPerfect = false
        continue
      }
      const d = Math.abs(predShots - resShots)
      if (d <= 2) add(`shots-${side}`, `Shots within 2 (${side})`, POINTS.shotsTight)
      else if (d <= 4) add(`shots-${side}`, `Shots within 4 (${side})`, POINTS.shotsClose)
      if (d > 2) statsPerfect = false
    }
  }

  // 10. Perfect bonus — exact scoreline, every goal reconstructed exactly, and
  // (for a goalless call) possession & shots in the top tier.
  const perfect = exact && goalsPerfect && (pred.outcome !== 'goalless-draw' || statsPerfect)
  if (perfect) add('perfect', 'Perfect prediction!', POINTS.perfect)

  const total = lines.reduce((n, l) => n + l.points, 0)
  return { total, lines }
}
