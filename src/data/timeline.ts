export type Bucket = {
  id: number
  label: string
  /** Inclusive lower bound in minutes (for display / engine later) */
  from: number
  /** Exclusive upper bound, or null for 90'+ (added/extra time) */
  to: number | null
}

/** Regulation time: 0–10, 10–20, … 80–90, then 90'+ — bottom (0') to top. */
export const REGULATION_BUCKETS: Bucket[] = [
  { id: 0, label: "0–10'", from: 0, to: 10 },
  { id: 1, label: "10–20'", from: 10, to: 20 },
  { id: 2, label: "20–30'", from: 20, to: 30 },
  { id: 3, label: "30–40'", from: 30, to: 40 },
  { id: 4, label: "40–50'", from: 40, to: 50 },
  { id: 5, label: "50–60'", from: 50, to: 60 },
  { id: 6, label: "60–70'", from: 60, to: 70 },
  { id: 7, label: "70–80'", from: 70, to: 80 },
  { id: 8, label: "80–90'", from: 80, to: 90 },
  { id: 9, label: "90'+", from: 90, to: null },
]

/**
 * Extra time — the two added 15-minute halves only reachable in a knockout tie
 * level after 90'. Sit above regulation on the timeline (ids continue 10, 11).
 */
export const EXTRA_TIME_BUCKETS: Bucket[] = [
  { id: 10, label: "ET 90–105'", from: 90, to: 105 },
  { id: 11, label: "ET 105–120'", from: 105, to: null },
]

/**
 * Every bracket, indexed by id (id === array index) so `BUCKETS[goal.bucket]`
 * resolves a label for any goal — regulation or extra time.
 */
export const BUCKETS: Bucket[] = [...REGULATION_BUCKETS, ...EXTRA_TIME_BUCKETS]

/**
 * Brackets to offer for a fixture: regulation always, plus the two extra-time
 * halves for knockout games (which can go to ET when level after 90').
 */
export function bucketsForMatch(knockout: boolean): Bucket[] {
  return knockout ? BUCKETS : REGULATION_BUCKETS
}
