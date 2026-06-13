import type { Team } from './types'
import { WC_TEAMS, type WcTeam } from './worldCup2026'

/** Brand colour per FIFA code (used for ball rings, possession bars, tints). */
const COLORS: Record<string, string> = {
  MEX: '#006847', RSA: '#007749', KOR: '#cd2e3a', CZE: '#11457e',
  CAN: '#d52b1e', BIH: '#002395', QAT: '#8a1538', SUI: '#d52b1e',
  BRA: '#1aa35a', MAR: '#c1272d', HAI: '#00209f', SCO: '#0065bf',
  USA: '#0a3161', PAR: '#d52b1e', AUS: '#00843d', TUR: '#e30a17',
  GER: '#b8932f', CUW: '#002b7f', CIV: '#ff8200', ECU: '#ffd100',
  NED: '#f36c21', JPN: '#1f3a93', SWE: '#006aa7', TUN: '#e70013',
  BEL: '#c8102e', EGY: '#c8102e', IRN: '#239f40', NZL: '#00247d',
  ESP: '#c60b1e', CPV: '#003893', KSA: '#006c35', URU: '#5cbfeb',
  FRA: '#1e2f97', SEN: '#00853f', IRQ: '#007a3b', NOR: '#ba0c2f',
  ARG: '#75aadb', ALG: '#006233', AUT: '#ed2939', JOR: '#007a3d',
  POR: '#006600', COD: '#007fff', UZB: '#1eb53a', COL: '#fcd116',
  ENG: '#ce1124', CRO: '#d10000', GHA: '#006b3f', PAN: '#da121a',
}

/** Deterministic fallback colour for any team missing from COLORS. */
function fallbackColor(seed: string): string {
  let h = 0
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) % 360
  return `hsl(${h} 62% 45%)`
}

function isoToEmoji(iso2: string): string {
  const cc = iso2.toUpperCase()
  if (cc.length !== 2) return '🏳️'
  return String.fromCodePoint(
    ...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
  )
}

/** Tag-sequence emoji for UK home nations, e.g. subdivisionFlag('sct'). */
function subdivisionFlag(sub: string): string {
  const tags = [...`gb${sub}`].map((c) => 0xe0000 + c.charCodeAt(0))
  return String.fromCodePoint(0x1f3f4, ...tags, 0xe007f)
}

const HOME_NATION: Record<string, { emoji: string }> = {
  'gb-eng': { emoji: subdivisionFlag('eng') },
  'gb-sct': { emoji: subdivisionFlag('sct') },
  'gb-wls': { emoji: subdivisionFlag('wls') },
  'gb-nir': { emoji: subdivisionFlag('nir') },
}

/** flagcdn code from the data URL (handles gb-sct / gb-eng), else iso2. */
function flagCode(wc: WcTeam): string {
  return wc.flag.match(/\/w\d+\/(.+?)\.png/)?.[1] ?? wc.iso2.toLowerCase()
}

function buildTeam(wc: WcTeam): Team {
  const code = flagCode(wc)
  return {
    id: String(wc.id),
    name: wc.name,
    code: wc.fifaCode,
    flag: HOME_NATION[code]?.emoji ?? isoToEmoji(wc.iso2),
    iso: code,
    color: COLORS[wc.fifaCode] ?? fallbackColor(wc.iso2),
    // Squads are fetched from the API on demand — see useSquad(team.code).
    squad: [],
  }
}

const BY_ID = new Map<number, Team>(WC_TEAMS.map((t) => [t.id, buildTeam(t)]))

export const ALL_TEAMS: Team[] = [...BY_ID.values()]

export function getTeam(wcId: number): Team | undefined {
  return BY_ID.get(wcId)
}
