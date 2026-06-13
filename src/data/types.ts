export type Player = {
  id: string
  name: string
  position: 'GK' | 'DEF' | 'MID' | 'FWD'
  number: number
  /** Prediction points awarded if this player scores (defenders worth more). */
  points: number
  /** Wikipedia headshot URL, or null — fall back to a generated avatar. */
  photo?: string | null
}

export type Team = {
  id: string
  name: string
  /** 3-letter code, e.g. BRA */
  code: string
  /** Emoji flag (for inline text use) */
  flag: string
  /** ISO 3166-1 alpha-2 code, e.g. br (for the Flag component) */
  iso: string
  /** Brand color (hex) used for the team's goal-balls and accents */
  color: string
  squad: Player[]
}

export type MatchStatus = 'open' | 'locked' | 'live' | 'finished'

export type Match = {
  id: string
  home: Team
  away: Team
  /** ISO kickoff time */
  kickoff: string
  venue: string
  group: string
  status: MatchStatus
}

export type LeaderboardEntry = {
  id: string
  rank: number
  username: string
  /** ISO 3166-1 alpha-2 country code, e.g. ma */
  country: string
  /** DiceBear seed for the avatar */
  seed: string
  points: number
  /** Number of correct predictions, for flavor */
  hits: number
}
