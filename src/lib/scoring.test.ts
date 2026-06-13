import { expect, test, describe } from 'bun:test'
import {
  scoreSubmission,
  type Prediction,
  type MatchResult,
  type GoalFact,
} from './scoring'

const g = (
  side: 'home' | 'away',
  bucket: number,
  scorerId: number | null = null,
  assistId: number | null = null,
): GoalFact => ({ side, bucket, scorerId, assistId })

const result = (over: Partial<MatchResult>): MatchResult => ({
  outcome: 'home',
  homeScore: 0,
  awayScore: 0,
  goals: [],
  possessionHome: 50,
  shotsHome: 0,
  shotsAway: 0,
  ...over,
})

const pred = (over: Partial<Prediction>): Prediction => ({
  outcome: 'home',
  homeScore: 0,
  awayScore: 0,
  goals: [],
  ...over,
})

describe('scoreSubmission', () => {
  test('outcome only', () => {
    const p = pred({ outcome: 'home', homeScore: 1, awayScore: 0, goals: [g('home', 2, 1)] })
    const r = result({ outcome: 'home', homeScore: 3, awayScore: 1, goals: [g('home', 5, 99), g('home', 6, 98), g('home', 7, 97), g('away', 8, 50)] })
    expect(scoreSubmission(p, r).total).toBe(5)
  })

  test('exact scoreline, no goal details matched', () => {
    const p = pred({ outcome: 'home', homeScore: 2, awayScore: 1, goals: [g('home', 1, 1), g('home', 2, 2), g('away', 3, 3)] })
    const r = result({ outcome: 'home', homeScore: 2, awayScore: 1, goals: [g('home', 7, 90), g('home', 8, 91), g('away', 9, 92)] })
    // 5 outcome + 3 count + 5 distribution + 10 exact
    expect(scoreSubmission(p, r).total).toBe(23)
  })

  test('distribution but wrong sides (2-0 vs 0-2)', () => {
    const p = pred({ outcome: 'home', homeScore: 2, awayScore: 0, goals: [g('home', 1, 1), g('home', 2, 2)] })
    const r = result({ outcome: 'away', homeScore: 0, awayScore: 2, goals: [g('away', 5, 50), g('away', 6, 51)] })
    // 3 count + 5 distribution (outcome wrong, not exact)
    expect(scoreSubmission(p, r).total).toBe(8)
  })

  test('perfect single-goal win', () => {
    const goal = g('home', 3, 10, 7)
    const p = pred({ outcome: 'home', homeScore: 1, awayScore: 0, goals: [goal] })
    const r = result({ outcome: 'home', homeScore: 1, awayScore: 0, goals: [g('home', 3, 10, 7)] })
    // 5+3+5+10 + (5+5+5) + 50 perfect = 88
    expect(scoreSubmission(p, r).total).toBe(88)
  })

  test('right scorer, wrong bracket, no assist', () => {
    const p = pred({ outcome: 'home', homeScore: 1, awayScore: 0, goals: [g('home', 5, 10, null)] })
    const r = result({ outcome: 'home', homeScore: 1, awayScore: 0, goals: [g('home', 3, 10, 7)] })
    // 23 scoreline + 5 scorer (no timing, no assist), not perfect
    expect(scoreSubmission(p, r).total).toBe(28)
  })

  test('no double counting: one pred goal cannot match two actual goals', () => {
    const p = pred({ outcome: 'home', homeScore: 1, awayScore: 0, goals: [g('home', 1, 10)] })
    const r = result({ outcome: 'home', homeScore: 2, awayScore: 0, goals: [g('home', 1, 99), g('home', 2, 10)] })
    // outcome 5, count 1!=2 no, distribution [0,1]vs[0,2] no, exact no.
    // matchSide: pred goal can take timing(5, bucket1) OR scorer(5, scorer10) — best is 5, not 10.
    expect(scoreSubmission(p, r).total).toBe(10)
  })

  test('goalless: possession + shots tiers, not perfect', () => {
    const p = pred({ outcome: 'goalless-draw', homeScore: 0, awayScore: 0, possessionHome: 55, shotsHome: 9, shotsAway: 6 })
    const r = result({ outcome: 'goalless-draw', homeScore: 0, awayScore: 0, possessionHome: 52, shotsHome: 10, shotsAway: 9 })
    // 5+3+5+10 + 10 possession(±3) + 7 shots-home(±1) + 5 shots-away(±3) = 45
    expect(scoreSubmission(p, r).total).toBe(45)
  })

  test('goalless: perfect', () => {
    const p = pred({ outcome: 'goalless-draw', homeScore: 0, awayScore: 0, possessionHome: 50, shotsHome: 8, shotsAway: 7 })
    const r = result({ outcome: 'goalless-draw', homeScore: 0, awayScore: 0, possessionHome: 50, shotsHome: 8, shotsAway: 7 })
    // 23 + 10 + 7 + 7 + 50 = 97
    expect(scoreSubmission(p, r).total).toBe(97)
  })

  test('possession within 10 (not 5) gives 5', () => {
    const p = pred({ outcome: 'goalless-draw', homeScore: 0, awayScore: 0, possessionHome: 60, shotsHome: 0, shotsAway: 0 })
    const r = result({ outcome: 'goalless-draw', homeScore: 0, awayScore: 0, possessionHome: 52, shotsHome: 0, shotsAway: 0 })
    // 23 + 5 possession(±8) + 7 + 7 shots(±0 each) ... not perfect (poss diff 8 > 5)
    // 5+3+5+10 + 5 + 7 + 7 = 42
    expect(scoreSubmission(p, r).total).toBe(42)
  })

  test('two goals both perfectly predicted', () => {
    const p = pred({
      outcome: 'home', homeScore: 2, awayScore: 0,
      goals: [g('home', 1, 10, 7), g('home', 8, 11, null)],
    })
    const r = result({
      outcome: 'home', homeScore: 2, awayScore: 0,
      goals: [g('home', 1, 10, 7), g('home', 8, 11, null)],
    })
    // 5+3+5+10 + goal1(5+5+5=15) + goal2(5+5+0=10, no assist) + 50 perfect = 98
    expect(scoreSubmission(p, r).total).toBe(98)
  })
})
