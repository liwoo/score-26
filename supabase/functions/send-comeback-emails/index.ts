// send-comeback-emails — re-engagement "We miss you / things are heating up".
//
// Audience (default): players with an account who have predicted before but
// predicted NONE of the last 3 kicked-off matches (lapsed). Each gets a
// personal `missed_games` = matches kicked off since their last prediction.
//
// Pass { "preview_to": "you@example.com" } to send ONE example to that address
// (rendered with their profile + the real next fixture & leader) without
// touching the real audience.
//
// Reads the `comeback` template + secrets from the DB (same wiring as
// send-match-emails). SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY auto-injected.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

const avatarUrl = (seed: string) =>
  `https://api.dicebear.com/9.x/fun-emoji/png?seed=${encodeURIComponent(
    seed,
  )}&radius=50&backgroundType=gradientLinear&size=96`

const render = (tpl: string, vars: Record<string, string>): string =>
  tpl.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_m, k) => vars[k] ?? '')

// Almost all players are in Malawi, so show kickoff in Malawi time (CAT = UTC+2,
// no daylight saving) rather than the US/Canada venue-local time.
const MW_OFFSET_MS = 2 * 60 * 60 * 1000
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const pad = (n: number) => String(n).padStart(2, '0')
const mwTime = (utcIso: string): string => {
  const d = new Date(new Date(utcIso).getTime() + MW_OFFSET_MS)
  return `${DOW[d.getUTCDay()]} ${d.getUTCDate()} ${MON[d.getUTCMonth()]} · ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
}

// Don't re-nag a player who got a comeback email within this window.
const SUPPRESS_DAYS = 6

Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}))
    const previewTo: string | null =
      typeof body?.preview_to === 'string' ? body.preview_to : null

    const db = createClient(SUPABASE_URL, SERVICE_ROLE)

    const secret = async (name: string): Promise<string | null> => {
      const { data } = await db.rpc('get_secret', { secret_name: name })
      return (data as string | null) ?? null
    }
    const RESEND_KEY = await secret('resend_api_key')
    const APP = (await secret('app_base_url')) ?? 'https://score26.app'
    const FROM = (await secret('email_from')) ?? 'score26 <results@score26.app>'
    if (!RESEND_KEY) return json({ error: 'resend_api_key not set in Vault' }, 500)

    const { data: tplRow, error: tplErr } = await db
      .from('email_templates')
      .select('html')
      .eq('name', 'comeback')
      .maybeSingle()
    if (tplErr) throw tplErr
    const tpl = (tplRow?.html as string) ?? ''
    if (!tpl) return json({ error: 'comeback template not found' }, 500)

    const { data: teams } = await db.from('teams').select('fifa_code, emoji')
    const emojiByCode = new Map<string, string>(
      (teams ?? []).map((t) => [t.fifa_code as string, (t.emoji as string) ?? '🏳️']),
    )

    const nowMs = Date.now()
    const nowIso = new Date().toISOString()

    // Next fixture (the hook).
    const { data: nxt } = await db
      .from('matches')
      .select('id, home_code, away_code, kickoff_utc')
      .gt('kickoff_utc', nowIso)
      .order('kickoff_utc', { ascending: true })
      .limit(1)
      .maybeSingle()
    const nextVars: Record<string, string> = nxt
      ? {
          next_home_code: nxt.home_code as string,
          next_away_code: nxt.away_code as string,
          next_home_emoji: emojiByCode.get(nxt.home_code as string) ?? '🏳️',
          next_away_emoji: emojiByCode.get(nxt.away_code as string) ?? '🏳️',
          next_kickoff: `${mwTime(nxt.kickoff_utc as string)} CAT`,
          next_match_url: `${APP}/play/${nxt.id}`,
        }
      : {
          next_home_code: '',
          next_away_code: '',
          next_home_emoji: '🏆',
          next_away_emoji: '🏆',
          next_kickoff: 'New fixtures soon',
          next_match_url: APP,
        }

    // Current leader (social proof).
    const { data: lead } = await db
      .from('leaderboard')
      .select('username, points')
      .eq('scope', 'all')
      .order('rank', { ascending: true })
      .limit(1)
      .maybeSingle()
    const leaderName = (lead?.username as string) ?? 'Someone'
    const leaderPoints = String(lead?.points ?? 0)

    // Match kickoffs + everyone's submissions (for audience + missed_games).
    const { data: allMatches } = await db.from('matches').select('id, kickoff_utc')
    const kickoffById = new Map<number, number>(
      (allMatches ?? []).map((m) => [m.id as number, new Date(m.kickoff_utc as string).getTime()]),
    )
    const startedCount = [...kickoffById.values()].filter((k) => k < nowMs).length
    const last3 = (allMatches ?? [])
      .filter((m) => (kickoffById.get(m.id as number) ?? Infinity) < nowMs)
      .sort((a, b) => (kickoffById.get(b.id as number)! - kickoffById.get(a.id as number)!))
      .slice(0, 3)
      .map((m) => m.id as number)

    const { data: allSubs } = await db.from('submissions').select('email, match_id')
    const subsByEmail = new Map<string, Set<number>>()
    for (const s of allSubs ?? []) {
      const e = s.email as string
      let set = subsByEmail.get(e)
      if (!set) subsByEmail.set(e, (set = new Set()))
      set.add(s.match_id as number)
    }
    const missedSince = (email: string): number => {
      const set = subsByEmail.get(email)
      if (!set || set.size === 0) return startedCount
      let lastKick = 0
      for (const mid of set) lastKick = Math.max(lastKick, kickoffById.get(mid) ?? 0)
      let n = 0
      for (const k of kickoffById.values()) if (k > lastKick && k < nowMs) n++
      return n
    }

    // Recipients.
    let recipients: string[]
    if (previewTo) {
      recipients = [previewTo]
    } else {
      const playedLast3 = new Set(
        (allSubs ?? [])
          .filter((s) => last3.includes(s.match_id as number))
          .map((s) => s.email as string),
      )
      const everPlayed = new Set((allSubs ?? []).map((s) => s.email as string))
      const { data: profilesAll } = await db.from('profiles').select('email')
      const lapsed = (profilesAll ?? [])
        .map((p) => p.email as string)
        .filter((e) => everPlayed.has(e) && !playedLast3.has(e))
      // Drop anyone already nudged within the suppression window.
      const cutoff = new Date(nowMs - SUPPRESS_DAYS * 86400_000).toISOString()
      const { data: recent } = await db
        .from('comeback_sends')
        .select('email')
        .gte('sent_at', cutoff)
      const suppressed = new Set((recent ?? []).map((r) => r.email as string))
      recipients = lapsed.filter((e) => !suppressed.has(e))
    }

    const { data: profs } = await db
      .from('profiles')
      .select('email, username, avatar_seed')
      .in('email', recipients.length ? recipients : ['__none__'])
    const profByEmail = new Map(
      (profs ?? []).map((p) => [p.email as string, p]),
    )

    const sent: string[] = []
    const failed: { email: string; error: string }[] = []
    for (const email of recipients) {
      const prof = profByEmail.get(email)
      let missed = missedSince(email)
      if (previewTo && missed < 1) missed = 3 // representative value for the example

      const seed = (prof?.avatar_seed as string) || email
      const vars: Record<string, string> = {
        player_name: (prof?.username as string) || 'there',
        avatar_url: avatarUrl(seed),
        missed_games: String(missed),
        leader_name: leaderName,
        leader_points: leaderPoints,
        ...nextVars,
        settings_url: `${APP}/settings`,
        help_url: `${APP}/settings/help`,
        unsubscribe_url: `${APP}/settings`,
      }

      const html = render(tpl, vars)
      const matchup = nextVars.next_home_code
        ? `${nextVars.next_home_code} v ${nextVars.next_away_code}`
        : 'the next match'
      const subject = `👋 We miss you, ${vars.player_name} — ${matchup} is coming up`

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from: FROM, to: [email], subject, html }),
      })
      if (res.ok) sent.push(email)
      else failed.push({ email, error: `${res.status} ${await res.text()}` })
    }

    // Record real sends so the next batch skips them (preview never records).
    if (!previewTo && sent.length) {
      await db.from('comeback_sends').insert(sent.map((email) => ({ email })))
    }

    return json({
      ok: true,
      preview: !!previewTo,
      audience: recipients.length,
      sent: sent.length,
      failed,
    })
  } catch (e) {
    console.error('send-comeback-emails error', e)
    return json({ error: String((e as Error)?.message ?? e) }, 500)
  }
})
