import type { LeaderboardEntry } from './types'

/** Overall, season-long leaders. */
export const ALLTIME_LEADERS: LeaderboardEntry[] = [
  { id: 'a1', rank: 1, username: 'GoalGremlin', country: 'br', seed: 'Bingo', points: 1842, hits: 141 },
  { id: 'a2', rank: 2, username: 'PitchWizard', country: 'ma', seed: 'Zara', points: 1790, hits: 137 },
  { id: 'a3', rank: 3, username: 'TikiTakaTom', country: 'pt', seed: 'Tom', points: 1703, hits: 130 },
  { id: 'a4', rank: 4, username: 'NutmegNina', country: 'ar', seed: 'Nina', points: 1655, hits: 126 },
  { id: 'a5', rank: 5, username: 'OffsideOllie', country: 'fr', seed: 'Ollie', points: 1588, hits: 121 },
  { id: 'a6', rank: 6, username: 'BicycleKick', country: 'jp', seed: 'Kenji', points: 1502, hits: 115 },
  { id: 'a7', rank: 7, username: 'DesertFox', country: 'ma', seed: 'Yasin', points: 1447, hits: 110 },
  { id: 'a8', rank: 8, username: 'SambaSteve', country: 'br', seed: 'Steve', points: 1399, hits: 107 },
]

/** Players leading today. */
export const DAY_LEADERS: LeaderboardEntry[] = [
  { id: 'd1', rank: 1, username: 'PitchWizard', country: 'ma', seed: 'Zara', points: 248, hits: 19 },
  { id: 'd2', rank: 2, username: 'GoalGremlin', country: 'br', seed: 'Bingo', points: 233, hits: 18 },
  { id: 'd3', rank: 3, username: 'NutmegNina', country: 'ar', seed: 'Nina', points: 221, hits: 17 },
  { id: 'd4', rank: 4, username: 'TikiTakaTom', country: 'pt', seed: 'Tom', points: 205, hits: 16 },
  { id: 'd5', rank: 5, username: 'BicycleKick', country: 'jp', seed: 'Kenji', points: 198, hits: 15 },
  { id: 'd6', rank: 6, username: 'OffsideOllie', country: 'fr', seed: 'Ollie', points: 184, hits: 14 },
]

const POOL = [
  { username: 'GoalGremlin', country: 'br', seed: 'Bingo' },
  { username: 'NutmegNina', country: 'ar', seed: 'Nina' },
  { username: 'AtlasLioness', country: 'ma', seed: 'Imane' },
  { username: 'SambaSteve', country: 'br', seed: 'Steve' },
  { username: 'PitchWizard', country: 'ma', seed: 'Zara' },
  { username: 'TikiTakaTom', country: 'pt', seed: 'Tom' },
  { username: 'BicycleKick', country: 'jp', seed: 'Kenji' },
  { username: 'OffsideOllie', country: 'fr', seed: 'Ollie' },
  { username: 'CafezinhoCaio', country: 'br', seed: 'Caio' },
  { username: 'DesertFox', country: 'ma', seed: 'Yasin' },
]

/**
 * Per-match leaders. Deterministic per matchId (no RNG) so the demo is stable:
 * the leaderboard for a chosen match is always the same set of players.
 */
export function getMatchLeaders(matchId: string): LeaderboardEntry[] {
  const offset = matchId.charCodeAt(matchId.length - 1)
  return Array.from({ length: 5 }, (_, i) => {
    const p = POOL[(offset + i * 3) % POOL.length]
    return {
      id: `${matchId}-${i}`,
      rank: i + 1,
      username: p.username,
      country: p.country,
      seed: p.seed,
      points: 68 - i * 6 - (offset % 4),
      hits: 5 - i,
    }
  })
}

/** The signed-in player (placeholder until auth lands). */
export const ME: LeaderboardEntry = {
  id: 'me',
  rank: 27,
  username: 'You',
  country: 'mw',
  seed: 'Champion',
  points: 96,
  hits: 8,
}

const FILLER_NAMES = [
  'StrikerSam', 'KeeperKaty', 'MidfieldMo', 'WingerWill', 'SuperSubSy',
  'BenchBoss', 'ExtraTimeEd', 'PenaltyPat', 'CornerCora', 'HatTrickHal',
  'CleanSheetCleo', 'LongShotLuca', 'GoldenGloria', 'Raboná Ray',
  'TackleTina', 'VolleyVlad', 'DribbleDee', 'HeaderHugo',
]
const FILLER_COUNTRIES = ['br', 'ma', 'ar', 'fr', 'pt', 'jp', 'mw', 'ng']

/**
 * Full standings for a tab: rank 1 down to the player's rank + 10 (so you can
 * scroll to your position and see a little below it, then the list ends). The
 * curated `top` entries fill the upper ranks; the rest are deterministic
 * filler with strictly descending points, and the player is slotted in at
 * their own rank.
 */
export function getStandings(top: LeaderboardEntry[]): LeaderboardEntry[] {
  const total = ME.rank + 10
  const startPts = top[top.length - 1]?.points ?? 200
  const dec = Math.max(2, Math.round(startPts / (total - top.length + 6)))

  const out: LeaderboardEntry[] = []
  let pts = startPts
  for (let rank = 1; rank <= total; rank++) {
    if (rank <= top.length) {
      out.push({ ...top[rank - 1], rank })
      continue
    }
    pts = Math.max(8, pts - dec)
    if (rank === ME.rank) {
      out.push({ ...ME, rank, points: pts })
    } else {
      const name = FILLER_NAMES[rank % FILLER_NAMES.length]
      out.push({
        id: `f-${rank}`,
        rank,
        username: name,
        country: FILLER_COUNTRIES[(rank * 3) % FILLER_COUNTRIES.length],
        seed: `${name}-${rank}`,
        points: pts,
        hits: Math.max(1, 18 - Math.floor(rank / 2)),
      })
    }
  }
  return out
}
