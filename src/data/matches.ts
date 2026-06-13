import type { Match, MatchStatus } from './types'
import { WC_MATCHES, wcStadiumById, type WcMatch } from './worldCup2026'
import { getTeam } from './teams'

/** Predictions close this many minutes before kickoff. */
export const LOCK_MINUTES = 10

/**
 * IANA timezone per stadium id. The source data stores kickoff as the venue's
 * local wall-clock time (US/Canada/Mexico), so we need the venue tz to recover
 * the true UTC instant and then display it in the user's own locale.
 */
const STADIUM_TZ: Record<number, string> = {
  1: 'America/Mexico_City', // Mexico City
  2: 'America/Mexico_City', // Guadalajara
  3: 'America/Monterrey', // Monterrey
  4: 'America/Chicago', // Dallas
  5: 'America/Chicago', // Houston
  6: 'America/Chicago', // Kansas City
  7: 'America/New_York', // Atlanta
  8: 'America/New_York', // Miami
  9: 'America/New_York', // Boston
  10: 'America/New_York', // Philadelphia
  11: 'America/New_York', // New York/New Jersey
  12: 'America/Toronto', // Toronto
  13: 'America/Vancouver', // Vancouver
  14: 'America/Los_Angeles', // Seattle
  15: 'America/Los_Angeles', // San Francisco Bay Area
  16: 'America/Los_Angeles', // Los Angeles
}

/** Offset in ms (tz wall-clock − UTC) for a timezone at a given instant. */
function tzOffsetMs(tz: string, at: Date): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const p: Record<string, number> = {}
  for (const part of dtf.formatToParts(at)) {
    if (part.type !== 'literal') p[part.type] = Number(part.value)
  }
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return asUtc - at.getTime()
}

/** Interpret a naive "YYYY-MM-DDTHH:mm:ss" as wall-clock in `tz` → UTC ISO. */
function venueLocalToUtcIso(naive: string, tz: string): string {
  const [d, t] = naive.split('T')
  const [y, mo, da] = d.split('-').map(Number)
  const [h, mi] = t.split(':').map(Number)
  const guess = Date.UTC(y, mo - 1, da, h, mi)
  // Two passes settle daylight-saving boundaries.
  let offset = tzOffsetMs(tz, new Date(guess))
  offset = tzOffsetMs(tz, new Date(guess - offset))
  return new Date(guess - offset).toISOString()
}

/**
 * Derive live status from the kickoff time so the demo always shows a believable
 * mix of open / locked / live / finished matches.
 */
export function statusOf(match: Pick<Match, 'kickoff'>): MatchStatus {
  const diffMin = (new Date(match.kickoff).getTime() - Date.now()) / 60_000
  if (diffMin > LOCK_MINUTES) return 'open'
  if (diffMin > 0) return 'locked'
  if (diffMin > -110) return 'live'
  return 'finished'
}

/** Minutes until predictions lock (negative once locked). */
export function minutesUntilLock(match: Pick<Match, 'kickoff'>): number {
  return Math.round(
    (new Date(match.kickoff).getTime() - Date.now()) / 60_000 - LOCK_MINUTES,
  )
}

function build(wc: WcMatch): Match | null {
  const home = getTeam(wc.homeTeamId)
  const away = getTeam(wc.awayTeamId)
  if (!home || !away || !wc.kickoff) return null // skip TBD knockout slots

  const stadium = wcStadiumById.get(wc.stadiumId)
  // wc.kickoff is the venue's local wall-clock; convert to a real UTC instant
  // so the UI can render it in the current user's locale.
  const tz = STADIUM_TZ[wc.stadiumId] ?? 'America/New_York'
  const kickoff = venueLocalToUtcIso(wc.kickoff, tz)
  return {
    id: String(wc.id),
    home,
    away,
    kickoff,
    venue: stadium ? `${stadium.name}, ${stadium.city}` : 'Venue TBD',
    group: `Group ${wc.group}`,
    status: statusOf({ kickoff }),
  }
}

// Only group-stage fixtures have both teams known; knockout slots are TBD.
const GROUP_FIXTURES = WC_MATCHES.filter((m) => m.type === 'group')

export function getMatches(): Match[] {
  return GROUP_FIXTURES.map(build)
    .filter((m): m is Match => m !== null)
    .sort((a, b) => +new Date(a.kickoff) - +new Date(b.kickoff))
}

export function getMatch(id: string): Match | undefined {
  const wc = WC_MATCHES.find((m) => String(m.id) === id)
  return wc ? (build(wc) ?? undefined) : undefined
}

export type MatchDay = {
  /** YYYY-MM-DD */
  key: string
  date: Date
  matches: Match[]
}

/** Local YYYY-MM-DD for a naive-ISO kickoff or a Date. */
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

/** Today's day key in the user's local timezone. */
export function todayKey(): string {
  return dayKey(new Date())
}

/** Group fixtures by the user's local calendar day, ascending. */
export function getMatchDays(): MatchDay[] {
  const byDay = new Map<string, Match[]>()
  for (const m of getMatches()) {
    const key = dayKey(new Date(m.kickoff)) // user-local day of the real instant
    const list = byDay.get(key)
    if (list) list.push(m)
    else byDay.set(key, [m])
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, matches]) => ({
      key,
      date: new Date(`${key}T00:00:00`),
      matches,
    }))
}
