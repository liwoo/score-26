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

/**
 * Fetch a team's squad from Supabase, keyed by FIFA code (the bridge between
 * the static `worldCup2026` team data and the scraped DB rows). Squads change
 * rarely, so they're cached aggressively.
 */
export function useSquad(fifaCode: string | undefined) {
  return useQuery({
    queryKey: ['squad', fifaCode],
    enabled: !!fifaCode,
    staleTime: Infinity,
    gcTime: Infinity,
    queryFn: async (): Promise<Player[]> => {
      const { data, error } = await supabase
        .from('players')
        .select('id, number, position, name, photo, teams!inner(fifa_code)')
        .eq('teams.fifa_code', fifaCode!)
        .order('number', { ascending: true })
      if (error) throw error
      return (data as unknown as Row[]).map(toPlayer)
    },
  })
}
