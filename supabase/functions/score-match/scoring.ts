// ⚠️ Deno copy of src/lib/scoring.ts — byte-identical (pure, no imports).
// src/lib/scoring.parity.test.ts fails if they drift; edit the source and
// re-copy. (cp src/lib/scoring.ts supabase/functions/score-match/)
/**
 * Score26 scoring engine — pure & dependency-free so it can run in the app, a
 * Node/Bun script, or a Supabase edge function without modification.
 *
 * Rubric (per submission, scored against the final match result):
 *   • Correct outcome (W/L/score-draw/goalless), any score ........... 5
 *   • Correct total number of goals in the match .................... 3
 *   • Correct goal spread — exact team-by-team scoring sequence over time .. 5
 *   • Exact scoreline (correct distribution AND sides) .............. 10
 *   • Each goal predicted in the correct time bracket (per side) ..... 5
 *   • Each goal's scorer predicted correctly ........................ 5
 *   • Each correctly-named assister (any goal that had one) ......... 5
 *   • Scorer + assister of the same goal both right (combo bonus) ... 5
 *   • Penalty shootout winner (knockout draws only, binary) ......... 5
 *   • Possession within 5 percentage points ........................ 10
 *   • Possession within 10 percentage points (tier, else) ........... 5
 *   • Total shots within 2, per team ................................ 7
 *   • Total shots within 4, per team (tier, else) ................... 5
 *   • Perfect prediction (everything maxed) — bonus ................ 50
 *
 * Possession & shots are only predicted for a goalless-draw call, so those
 * points are only attainable on a goalless-draw submission.
 *
 * Penalties: knockout fixtures can't truly draw — a level score after extra
 * time goes to a shootout. A draw prediction therefore carries a "who wins on
 * penalties" call. It's scored independently of everything else: a flat 5
 * points if the predicted shootout winner matches the actual one. The points
 * are only attainable when the real match actually went to penalties.
 */

export type Outcome = 'home' | 'away' | 'score-draw' | 'goalless-draw'

/** Side that wins a penalty shootout (knockout draws), or null for no shootout. */
export type PenaltyWinner = 'home' | 'away' | null

export type GoalFact = {
  side: 'home' | 'away'
  /** Timeline bracket 0–11 (0–10', …, 90'+, then ET 90–105' and ET 105–120'). */
  bucket: number
  /** Player id, or null. */
  scorerId: number | null
  /** Player id, null = no assist (solo goal). */
  assistId: number | null
  /** Own goal — no named scorer, no assist. Predicted/scored generically. */
  ownGoal?: boolean
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
  /** Knockout draws only — predicted shootout winner. */
  penaltyWinner?: PenaltyWinner
}

export type MatchResult = {
  outcome: Outcome
  homeScore: number
  awayScore: number
  goals: GoalFact[]
  possessionHome: number
  shotsHome: number
  shotsAway: number
  /** Set only when the match actually went to a penalty shootout. */
  penaltyWinner?: PenaltyWinner
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
  scorerAssistCombo: 5, // bonus for nailing scorer AND assister of the same goal
  penaltyWinner: 5, // binary: correct shootout winner on a knockout draw
  ownGoal: 10, // correctly calling a goal is an own goal
  possessionTight: 10, // within 5 pts
  possessionClose: 5, // within 10 pts
  shotsTight: 7, // within 2 (per team)
  shotsClose: 5, // within 4 (per team)
  perfect: 50,
} as const

/**
 * The chronological sequence of scoring sides as a string of 'h'/'a' — the goal
 * spread. Ordered by time bucket; order within a single bucket is canonicalised
 * (away before home) so same-bucket goals don't cause false mismatches.
 * Two predictions match the spread only if this string is identical (so a 1–1
 * where home scores first ≠ a 1–1 where away scores first).
 */
const sideSequence = (goals: GoalFact[]): string =>
  goals
    .slice()
    .sort((x, y) => x.bucket - y.bucket || x.side.localeCompare(y.side))
    .map((x) => x.side[0])
    .join('')

/** Number of elements common to both multisets. */
function multisetIntersect<T>(a: T[], b: T[]): number {
  const counts = new Map<T, number>()
  for (const x of a) counts.set(x, (counts.get(x) ?? 0) + 1)
  let n = 0
  for (const x of b) {
    const c = counts.get(x) ?? 0
    if (c > 0) {
      counts.set(x, c - 1)
      n++
    }
  }
  return n
}

/** Real assister player ids (excludes solo goals and own goals). */
const assisters = (goals: GoalFact[]): number[] =>
  goals.filter((g) => !g.ownGoal && g.assistId != null).map((g) => g.assistId as number)

/** "scorer:assister" keys for goals with BOTH a real scorer and assister. */
const scorerAssistPairs = (goals: GoalFact[]): string[] =>
  goals
    .filter((g) => !g.ownGoal && g.scorerId != null && g.assistId != null)
    .map((g) => `${g.scorerId}:${g.assistId}`)

// Timing / scorer / own-goal are matched per goal (optimal assignment). Assists
// are scored separately, match-wide.
type Components = { timing: number; scorer: number; ownGoal: number }

/** Value of pairing one predicted goal with one actual goal (same side). */
function pairValue(p: GoalFact, a: GoalFact): Components {
  return {
    timing: p.bucket === a.bucket ? POINTS.goalTiming : 0,
    // Normal scorer: same named player, and neither side an own goal.
    scorer:
      !p.ownGoal && !a.ownGoal && p.scorerId != null && p.scorerId === a.scorerId
        ? POINTS.goalScorer
        : 0,
    // Own goal correctly called (both predicted and actual are own goals).
    ownGoal: p.ownGoal && a.ownGoal ? POINTS.ownGoal : 0,
  }
}

/**
 * Best one-to-one assignment of predicted→actual goals (same side) maximising
 * total component points. Small N (goals per side), so exact DP over a bitmask
 * of used actual goals is fine.
 */
function matchSide(preds: GoalFact[], actuals: GoalFact[]): Components {
  const memo = new Map<string, Components & { total: number }>()
  const value = (c: Components) => c.timing + c.scorer + c.ownGoal

  function go(i: number, used: number): Components & { total: number } {
    if (i === preds.length)
      return { timing: 0, scorer: 0, ownGoal: 0, total: 0 }
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
        ownGoal: v.ownGoal + rest.ownGoal,
        total: value(v) + rest.total,
      }
      if (cand.total > best.total) best = cand
    }
    memo.set(key, best)
    return best
  }

  const r = go(0, 0)
  return { timing: r.timing, scorer: r.scorer, ownGoal: r.ownGoal }
}

/** Canonical key for a goal, for exact-match (perfect) comparison. */
const goalKey = (g: GoalFact) =>
  `${g.bucket}:${g.ownGoal ? 'OG' : (g.scorerId ?? 'x')}:${g.assistId ?? 'x'}`

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

  // 3. Goal spread — the exact chronological team-by-team sequence of goals
  //    (e.g. home-then-away ≠ away-then-home for a 1–1). Needs goal placements,
  //    so a scoreline-only prediction can't earn it.
  if (sideSequence(pred.goals) === sideSequence(result.goals))
    add('distribution', 'Correct goal spread', POINTS.distribution)
  // 4. Exact scoreline (final ordered numbers)
  const exact =
    pred.homeScore === result.homeScore && pred.awayScore === result.awayScore
  if (exact) add('exactScore', 'Exact scoreline', POINTS.exactScore)

  // 5–6. Goal timing / scorer (+ own goals), matched per side (optimal pairing).
  let goalsPerfect = true
  for (const side of ['home', 'away'] as const) {
    const p = pred.goals.filter((g) => g.side === side)
    const a = result.goals.filter((g) => g.side === side)
    const c = matchSide(p, a)
    if (c.timing)
      add(`timing-${side}`, `Goal timing ×${c.timing / POINTS.goalTiming} (${side})`, c.timing)
    if (c.scorer)
      add(`scorer-${side}`, `Goal scorer ×${c.scorer / POINTS.goalScorer} (${side})`, c.scorer)
    if (c.ownGoal)
      add(`og-${side}`, `Own goal ×${c.ownGoal / POINTS.ownGoal} (${side})`, c.ownGoal)
    if (!goalsIdentical(p, a)) goalsPerfect = false
  }

  // 7. Assisters — decoupled from goal pairing: any correctly-named assister of
  //    a goal that actually had one (match-wide, multiset over player ids).
  const assistHits = multisetIntersect(assisters(pred.goals), assisters(result.goals))
  if (assistHits > 0)
    add('assist', `Correct assister ×${assistHits}`, assistHits * POINTS.goalAssister)

  // 8. Combo bonus — nailing BOTH the scorer and assister of the same goal.
  const comboHits = multisetIntersect(
    scorerAssistPairs(pred.goals),
    scorerAssistPairs(result.goals),
  )
  if (comboHits > 0)
    add('combo', `Scorer + assister combo ×${comboHits}`, comboHits * POINTS.scorerAssistCombo)

  // 8b. Penalty shootout — knockout draws only. Binary: 5 points if the player's
  //     predicted shootout winner matches the actual one. Only scorable when the
  //     match really went to penalties (result.penaltyWinner set).
  if (
    pred.penaltyWinner != null &&
    result.penaltyWinner != null &&
    pred.penaltyWinner === result.penaltyWinner
  )
    add('penalty', 'Correct penalty shootout winner', POINTS.penaltyWinner)

  // 9. Possession & 10. shots — only when the player called a goalless draw.
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

  // 11. Perfect bonus — exact scoreline, every goal reconstructed exactly, and
  // (for a goalless call) possession & shots in the top tier.
  const perfect = exact && goalsPerfect && (pred.outcome !== 'goalless-draw' || statsPerfect)
  if (perfect) add('perfect', 'Perfect prediction!', POINTS.perfect)

  const total = lines.reduce((n, l) => n + l.points, 0)
  return { total, lines }
}
