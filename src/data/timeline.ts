export type Bucket = {
  id: number
  label: string
  /** Inclusive lower bound in minutes (for display / engine later) */
  from: number
  /** Exclusive upper bound, or null for 90'+ (added/extra time) */
  to: number | null
}

/** 0–10, 10–20, … 80–90, then 90'+ — bottom (0') to top (90'+). */
export const BUCKETS: Bucket[] = [
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
