// score-match — fired by the AFTER trigger on public.match_outcomes.
//
// Given a finalised match outcome (entered as jersey# + minute per side), this:
//   1. resolves jersey numbers → DB player ids (via teams.fifa_code + number),
//   2. mirrors the result into match_results + result_goals (what the app reads),
//   3. scores EVERY submission for the match with the shared scoring engine,
//      writing submissions.points,
//   4. records per-player progress in match_outcomes.calculation_status, and
//   5. once every player is calculated, hands off to send-match-emails.
//
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are auto-injected into the runtime.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import {
  scoreSubmission,
  type GoalFact,
  type MatchResult,
  type Outcome,
} from './scoring.ts'
import {
  predictionFromSubmission,
  type GoalRow,
  type SubmissionRow,
} from './scoringAdapters.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

type ScorerEntry = { no?: number | null; min?: number | null; assist_no?: number | null }
type CalcEntry = { email: string; calculated: boolean; email_sent: boolean }

/** Match minute → timeline bucket (0–10'=0 … 80–90'=8, 90'+=9). */
const minToBucket = (min: number): number => {
  if (!Number.isFinite(min) || min < 0) return 0
  if (min >= 90) return 9
  return Math.floor(min / 10)
}

const outcomeOf = (home: number, away: number): Outcome =>
  home > away ? 'home' : away > home ? 'away' : home > 0 ? 'score-draw' : 'goalless-draw'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}))
    // Accept a plain { match_id } or a DB-webhook-style { record: { match_id } }.
    const matchId = Number(body?.match_id ?? body?.record?.match_id)
    if (!Number.isFinite(matchId)) return json({ error: 'match_id required' }, 400)

    const db = createClient(SUPABASE_URL, SERVICE_ROLE)

    // 0. Load the outcome row.
    const { data: oc, error: ocErr } = await db
      .from('match_outcomes')
      .select('*')
      .eq('match_id', matchId)
      .maybeSingle()
    if (ocErr) throw ocErr
    if (!oc) return json({ error: 'no outcome for match' }, 404)
    if (oc.status !== 'final') return json({ skipped: 'status is draft', match_id: matchId })

    // 1. Resolve the two teams (by FIFA code) and a (team_id, number) → id map.
    const { data: teams, error: tErr } = await db
      .from('teams')
      .select('id, fifa_code')
      .in('fifa_code', [oc.home_code, oc.away_code])
    if (tErr) throw tErr
    const teamIdByCode = new Map<string, number>(
      (teams ?? []).map((t) => [t.fifa_code as string, t.id as number]),
    )
    const homeTeamId = teamIdByCode.get(oc.home_code)
    const awayTeamId = teamIdByCode.get(oc.away_code)
    if (homeTeamId == null || awayTeamId == null)
      return json({ error: `unknown team code(s): ${oc.home_code}/${oc.away_code}` }, 400)

    const { data: players, error: pErr } = await db
      .from('players')
      .select('id, team_id, number')
      .in('team_id', [homeTeamId, awayTeamId])
    if (pErr) throw pErr
    const playerByNo = new Map<string, number>()
    for (const p of players ?? []) playerByNo.set(`${p.team_id}:${p.number}`, p.id as number)
    const resolve = (teamId: number, no?: number | null): number | null =>
      no == null ? null : (playerByNo.get(`${teamId}:${no}`) ?? null)

    // 2. Build the actual result (GoalFact[] + scoreline + stats).
    const homeScorers = (oc.home_scorers ?? []) as ScorerEntry[]
    const awayScorers = (oc.away_scorers ?? []) as ScorerEntry[]
    const toGoals = (arr: ScorerEntry[], side: 'home' | 'away', teamId: number): GoalFact[] =>
      arr.map((g) => ({
        side,
        bucket: minToBucket(Number(g.min)),
        scorerId: resolve(teamId, g.no),
        assistId: resolve(teamId, g.assist_no),
      }))
    const goals: GoalFact[] = [
      ...toGoals(homeScorers, 'home', homeTeamId),
      ...toGoals(awayScorers, 'away', awayTeamId),
    ]
    const homeScore = homeScorers.length
    const awayScore = awayScorers.length
    const outcome = outcomeOf(homeScore, awayScore)
    const result: MatchResult = {
      outcome,
      homeScore,
      awayScore,
      goals,
      possessionHome: oc.home_possession ?? 50,
      shotsHome: oc.home_shots ?? 0,
      shotsAway: oc.away_shots ?? 0,
    }

    // 3. Mirror into match_results + result_goals (the app's read model).
    const now = new Date().toISOString()
    const { error: mrErr } = await db.from('match_results').upsert(
      {
        match_id: matchId,
        status: 'finished',
        outcome,
        home_score: homeScore,
        away_score: awayScore,
        possession_home: oc.home_possession,
        shots_home: oc.home_shots,
        shots_away: oc.away_shots,
        finalized_at: now,
      },
      { onConflict: 'match_id' },
    )
    if (mrErr) throw mrErr

    await db.from('result_goals').delete().eq('match_id', matchId)
    const goalRows = [
      ...homeScorers.map((g) => ({
        match_id: matchId,
        side: 'home',
        bucket: minToBucket(Number(g.min)),
        minute: g.min ?? null,
        scorer_player_id: resolve(homeTeamId, g.no),
        assist_player_id: resolve(homeTeamId, g.assist_no),
      })),
      ...awayScorers.map((g) => ({
        match_id: matchId,
        side: 'away',
        bucket: minToBucket(Number(g.min)),
        minute: g.min ?? null,
        scorer_player_id: resolve(awayTeamId, g.no),
        assist_player_id: resolve(awayTeamId, g.assist_no),
      })),
    ]
    if (goalRows.length) {
      const { error: rgErr } = await db.from('result_goals').insert(goalRows)
      if (rgErr) throw rgErr
    }

    // 4. Score every submission for this match.
    const { data: subs, error: sErr } = await db
      .from('submissions')
      .select(
        'id, email, outcome, winner_goals, loser_goals, possession_home, shots_home, shots_away, ' +
          'submission_goals(side, bucket, scorer_player_id, assist_player_id)',
      )
      .eq('match_id', matchId)
    if (sErr) throw sErr

    let scored = 0
    for (const s of subs ?? []) {
      const pred = predictionFromSubmission(
        s as unknown as SubmissionRow,
        (s.submission_goals ?? []) as GoalRow[],
      )
      const { total, lines } = scoreSubmission(pred, result)
      const { error: uErr } = await db
        .from('submissions')
        .update({ points: total, breakdown: lines })
        .eq('id', s.id)
      if (uErr) throw uErr
      scored++
    }

    // 5. Per-player progress (keyed by email), preserving any email_sent flags.
    const prev = new Map<string, CalcEntry>(
      ((oc.calculation_status ?? []) as CalcEntry[]).map((e) => [e.email, e]),
    )
    const emails = [...new Set((subs ?? []).map((s) => s.email as string))]
    const calc: CalcEntry[] = emails.map((email) => ({
      email,
      calculated: true,
      email_sent: prev.get(email)?.email_sent ?? false,
    }))
    const { error: csErr } = await db
      .from('match_outcomes')
      .update({ calculation_status: calc, scored_at: now })
      .eq('match_id', matchId)
    if (csErr) throw csErr

    // Roll the new points into the leaderboard (all / match / day scopes).
    const { error: lbErr } = await db.rpc('recompute_leaderboard', {
      p_match_id: matchId,
    })
    if (lbErr) throw lbErr

    // 6. Once everyone is calculated and someone still needs an email, hand off.
    const allCalculated = calc.length > 0 && calc.every((e) => e.calculated)
    const pendingEmails = calc.some((e) => !e.email_sent)
    let emailTriggered = false
    if (allCalculated && pendingEmails) {
      await fetch(`${SUPABASE_URL}/functions/v1/send-match-emails`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SERVICE_ROLE}`,
        },
        body: JSON.stringify({ match_id: matchId }),
      }).catch((e) => console.error('send-match-emails invoke failed', e))
      emailTriggered = true
    }

    return json({
      ok: true,
      match_id: matchId,
      scoreline: `${homeScore}-${awayScore}`,
      outcome,
      scored,
      players: calc.length,
      emailTriggered,
    })
  } catch (e) {
    console.error('score-match error', e)
    return json({ error: String((e as Error)?.message ?? e) }, 500)
  }
})
