// send-match-emails — invoked by score-match once every player for a match has
// been scored (calculation_status all `calculated: true`). Renders the
// game-styled match-result template per player and sends via Resend, then flips
// email_sent; stamps emails_done_at once everyone has been emailed.
//
// Secrets (resend_api_key, app_base_url, email_from) live in Supabase Vault and
// are read via the service_role-only public.get_secret() RPC.
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are auto-injected.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

type CalcEntry = { email: string; calculated: boolean; email_sent: boolean }

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

const ordinal = (n: number): string => {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`
}

const CALL_LABEL = (outcome: string, homeCode: string, awayCode: string): string => {
  switch (outcome) {
    case 'home':
      return homeCode
    case 'away':
      return awayCode
    case 'score-draw':
      return 'Draw'
    case 'goalless-draw':
      return '0-0 Draw'
    default:
      return '—'
  }
}

function badge(pos: number, total: number): {
  emoji: string
  title: string
  subtitle: string
} {
  if (pos === 1) return { emoji: '🥇', title: 'First Place', subtitle: 'You won this round!' }
  if (pos === 2) return { emoji: '🥈', title: 'Second Place', subtitle: 'So close — silver!' }
  if (pos === 3) return { emoji: '🥉', title: 'Third Place', subtitle: 'On the podium!' }
  const pct = total > 0 ? pos / total : 1
  if (pct <= 0.1) return { emoji: '🔥', title: 'Top 10%', subtitle: 'On fire this round!' }
  if (pct <= 0.5) return { emoji: '👏', title: 'Top half', subtitle: 'Climbing the table!' }
  return { emoji: '⚽', title: `${ordinal(pos)} place`, subtitle: 'Keep predicting!' }
}

function growthBits(delta: number): {
  caption: string
  value: string
  bg: string
  fg: string
} {
  if (delta > 0) return { caption: '▲', value: String(delta), bg: '#caf0d8', fg: '#137a43' }
  if (delta < 0) return { caption: '▼', value: String(-delta), bg: '#ffd9da', fg: '#d2342f' }
  return { caption: '—', value: '', bg: '#efe6cf', fg: '#7a6f5d' }
}

const avatarUrl = (seed: string) =>
  `https://api.dicebear.com/9.x/fun-emoji/png?seed=${encodeURIComponent(
    seed,
  )}&radius=50&backgroundType=gradientLinear&size=96`

function render(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_m, k) => vars[k] ?? '')
}

Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}))
    const matchId = Number(body?.match_id ?? body?.record?.match_id)
    if (!Number.isFinite(matchId)) return json({ error: 'match_id required' }, 400)

    const db = createClient(SUPABASE_URL, SERVICE_ROLE)

    // Secrets from Vault.
    const secret = async (name: string): Promise<string | null> => {
      const { data } = await db.rpc('get_secret', { secret_name: name })
      return (data as string | null) ?? null
    }
    const RESEND_KEY = await secret('resend_api_key')
    const APP = (await secret('app_base_url')) ?? 'https://score26.app'
    const FROM = (await secret('email_from')) ?? 'score26 <results@score26.app>'
    if (!RESEND_KEY) return json({ error: 'resend_api_key not set in Vault' }, 500)

    // Outcome + calc status.
    const { data: oc, error: ocErr } = await db
      .from('match_outcomes')
      .select('home_code, away_code, home_score, away_score, calculation_status')
      .eq('match_id', matchId)
      .maybeSingle()
    if (ocErr) throw ocErr
    if (!oc) return json({ error: 'no outcome for match' }, 404)
    const calc = (oc.calculation_status ?? []) as CalcEntry[]
    const finalScore = `${oc.home_score}-${oc.away_score}`

    // Team emojis for this match + the next fixture.
    const { data: teams } = await db.from('teams').select('fifa_code, emoji')
    const emojiByCode = new Map<string, string>(
      (teams ?? []).map((t) => [t.fifa_code as string, (t.emoji as string) ?? '🏳️']),
    )

    // Next fixture (chronologically after this one).
    let nextHome = '',
      nextAway = '',
      nextKickoff = 'Knockouts coming soon',
      nextUrl = `${APP}`
    const { data: thisMatch } = await db
      .from('matches')
      .select('kickoff_utc')
      .eq('id', matchId)
      .maybeSingle()
    if (thisMatch?.kickoff_utc) {
      const { data: nxt } = await db
        .from('matches')
        .select('id, home_code, away_code, city, local_time')
        .gt('kickoff_utc', thisMatch.kickoff_utc)
        .order('kickoff_utc', { ascending: true })
        .limit(1)
        .maybeSingle()
      if (nxt) {
        nextHome = nxt.home_code as string
        nextAway = nxt.away_code as string
        nextKickoff = `${nxt.city}, ${nxt.local_time}`
        nextUrl = `${APP}/play/${nxt.id}`
      }
    }

    // Best points + chosen outcome per player for THIS match (match ranking).
    const { data: matchSubs, error: msErr } = await db
      .from('submissions')
      .select('email, points, outcome')
      .eq('match_id', matchId)
    if (msErr) throw msErr
    const bestHere = new Map<string, { points: number; outcome: string }>()
    for (const s of matchSubs ?? []) {
      const cur = bestHere.get(s.email as string)
      if (!cur || (s.points ?? 0) > cur.points)
        bestHere.set(s.email as string, { points: s.points ?? 0, outcome: s.outcome as string })
    }
    const matchRanked = [...bestHere.entries()].sort((a, b) => b[1].points - a[1].points)
    const matchRankByEmail = new Map<string, number>(
      matchRanked.map(([email], i) => [email, i + 1]),
    )
    const totalInMatch = matchRanked.length

    // Overall standings BEFORE vs AFTER this match → snapshot-free rank growth.
    // total[email]   = Σ best-points-per-match over all matches (current).
    // before[email]  = total minus this match's best (as if it weren't scored).
    const { data: allSubs, error: asErr } = await db
      .from('submissions')
      .select('email, match_id, points')
    if (asErr) throw asErr
    const bestPerMatch = new Map<string, Map<number, number>>() // email -> matchId -> best
    for (const s of allSubs ?? []) {
      const email = s.email as string
      const mid = s.match_id as number
      const pts = s.points ?? 0
      let m = bestPerMatch.get(email)
      if (!m) bestPerMatch.set(email, (m = new Map()))
      m.set(mid, Math.max(m.get(mid) ?? 0, pts))
    }
    const total = new Map<string, number>()
    const before = new Map<string, number>()
    for (const [email, perMatch] of bestPerMatch) {
      let sum = 0
      for (const v of perMatch.values()) sum += v
      total.set(email, sum)
      before.set(email, sum - (perMatch.get(matchId) ?? 0))
    }
    const rankMap = (m: Map<string, number>): Map<string, number> => {
      const sorted = [...m.entries()].sort((a, b) => b[1] - a[1])
      return new Map(sorted.map(([email], i) => [email, i + 1]))
    }
    const rankNow = rankMap(total)
    const rankBefore = rankMap(before)

    // Recipients = players in this match still needing an email.
    const recipients = calc.filter((c) => c.calculated && !c.email_sent).map((c) => c.email)
    const { data: profiles } = await db
      .from('profiles')
      .select('email, username, avatar_seed')
      .in('email', recipients.length ? recipients : ['__none__'])
    const profByEmail = new Map(
      (profiles ?? []).map((p) => [p.email as string, p]),
    )

    // Template lives in public.email_templates (seeded from the repo's
    // match-result.html) so it can be tweaked without redeploying the function.
    const { data: tplRow, error: tplErr } = await db
      .from('email_templates')
      .select('html')
      .eq('name', 'match-result')
      .maybeSingle()
    if (tplErr) throw tplErr
    const tpl = (tplRow?.html as string) ?? ''
    if (!tpl) return json({ error: 'match-result template not found' }, 500)

    const sent: string[] = []
    const failed: { email: string; error: string }[] = []
    for (const email of recipients) {
      const prof = profByEmail.get(email)
      const here = bestHere.get(email)
      const pos = matchRankByEmail.get(email) ?? totalInMatch
      const b = badge(pos, totalInMatch)
      const delta = (rankBefore.get(email) ?? 0) - (rankNow.get(email) ?? 0)
      const g = growthBits(delta)
      const seed = (prof?.avatar_seed as string) || email

      const vars: Record<string, string> = {
        player_name: (prof?.username as string) || 'Player',
        avatar_url: avatarUrl(seed),
        home_code: oc.home_code,
        away_code: oc.away_code,
        home_emoji: emojiByCode.get(oc.home_code) ?? '🏳️',
        away_emoji: emojiByCode.get(oc.away_code) ?? '🏳️',
        final_score: finalScore,
        your_call: CALL_LABEL(here?.outcome ?? '', oc.home_code, oc.away_code),
        points: String(here?.points ?? 0),
        match_rank_ordinal: ordinal(pos),
        players_in_match: String(totalInMatch),
        badge_emoji: b.emoji,
        badge_title: b.title,
        badge_subtitle: b.subtitle,
        growth_caption: g.caption,
        growth_value: g.value,
        growth_bg: g.bg,
        growth_fg: g.fg,
        next_home_code: nextHome,
        next_away_code: nextAway,
        next_home_emoji: nextHome ? (emojiByCode.get(nextHome) ?? '🏳️') : '🏆',
        next_away_emoji: nextAway ? (emojiByCode.get(nextAway) ?? '🏳️') : '🏆',
        next_kickoff: nextKickoff,
        next_match_url: nextUrl,
        settings_url: `${APP}/settings`,
        help_url: `${APP}/settings/help`,
        unsubscribe_url: `${APP}/settings`,
      }

      const html = render(tpl, vars)
      const subject = `${b.emoji} ${oc.home_code} ${finalScore} ${oc.away_code} — you scored ${vars.points} pts!`

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from: FROM, to: [email], subject, html }),
      })
      if (res.ok) {
        sent.push(email)
      } else {
        failed.push({ email, error: `${res.status} ${await res.text()}` })
      }
    }

    // Flip email_sent for everyone we successfully emailed.
    if (sent.length) {
      const sentSet = new Set(sent)
      const updated = calc.map((c) =>
        sentSet.has(c.email) ? { ...c, email_sent: true } : c,
      )
      const allSent = updated.every((c) => c.email_sent)
      await db
        .from('match_outcomes')
        .update({
          calculation_status: updated,
          emails_done_at: allSent ? new Date().toISOString() : null,
        })
        .eq('match_id', matchId)
    }

    return json({ ok: true, match_id: matchId, sent: sent.length, failed })
  } catch (e) {
    console.error('send-match-emails error', e)
    return json({ error: String((e as Error)?.message ?? e) }, 500)
  }
})
