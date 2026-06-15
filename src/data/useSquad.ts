import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Player } from './types'

/** Same placeholder points model as the rest of the app (engine TBD). */
const PTS: Record<Player['position'], number> = {
  GK: 12,
  DEF: 8,
  MID: 5,
  FWD: 4,
}

const POSITION_ORDER: Record<Player['position'], number> = {
  GK: 0,
  DEF: 1,
  MID: 2,
  FWD: 3,
}

const SQUAD_QUERY_VERSION = 'v2-position-order'

type Row = {
  id: number
  number: number | null
  position: string
  name: string
  photo: string | null
}

function toPlayer(r: Row): Player {
  const position = (['GK', 'DEF', 'MID', 'FWD'].includes(r.position)
    ? r.position
    : 'MID') as Player['position']
  return {
    id: String(r.id),
    name: r.name,
    position,
    number: r.number ?? 0,
    points: PTS[position],
    photo: r.photo,
  }
}

function sortByPositionThenNumber(players: Player[]): Player[] {
  return [...players].sort((a, b) => {
    const pos = POSITION_ORDER[a.position] - POSITION_ORDER[b.position]
    if (pos !== 0) return pos
    if (a.number !== b.number) return a.number - b.number
    return a.name.localeCompare(b.name)
  })
}

/**
 * Fetch a team's squad from Supabase, keyed by FIFA code (the bridge between
 * the static `worldCup2026` team data and the scraped DB rows). Squads change
 * rarely, so they're cached aggressively.
 */
export function useSquad(fifaCode: string | undefined) {
  return useQuery({
    queryKey: ['squad', SQUAD_QUERY_VERSION, fifaCode],
    enabled: !!fifaCode,
    staleTime: Infinity,
    gcTime: Infinity,
    queryFn: async (): Promise<Player[]> => {
      const selectCols = 'id, number, position, name, photo'

      const { data, error } = await supabase
        .from('players')
        .select(`${selectCols}, teams!inner(fifa_code)`)
        .eq('teams.fifa_code', fifaCode!)
        .order('number', { ascending: true })
      if (!error && data && data.length > 0) {
        return sortByPositionThenNumber((data as unknown as Row[]).map(toPlayer))
      }

      // Some deployments load players with fifa_code but no joinable teams rows.
      // Fall back to direct fifa_code filtering so timeline picks still work.
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('players')
        .select(selectCols)
        .eq('fifa_code', fifaCode!)
        .order('number', { ascending: true })

      if (fallbackError) {
        if (error) throw error
        throw fallbackError
      }

      return sortByPositionThenNumber(
        (fallbackData as unknown as Row[]).map(toPlayer),
      )
    },
  })
}
