export type Country = { iso: string; name: string }

/** Max predictions a player may submit per match (engine keeps the highest). */
export const MAX_PREDICTIONS = 3

/** Countries a player can fly on the leaderboard. */
export const COUNTRIES: Country[] = [
  { iso: 'mw', name: 'Malawi' },
  { iso: 'br', name: 'Brazil' },
  { iso: 'ma', name: 'Morocco' },
  { iso: 'ar', name: 'Argentina' },
  { iso: 'fr', name: 'France' },
  { iso: 'pt', name: 'Portugal' },
  { iso: 'jp', name: 'Japan' },
  { iso: 'ng', name: 'Nigeria' },
]

/** Avatar seeds the player shuffles through when setting up a profile. */
export const SEEDS = [
  'Champion',
  'Pelé',
  'Zaza',
  'Koko',
  'Rocket',
  'Mambo',
  'Fifi',
  'Tango',
]

export function countryByIso(iso: string | null | undefined): Country {
  return COUNTRIES.find((c) => c.iso === iso) ?? COUNTRIES[0]
}
