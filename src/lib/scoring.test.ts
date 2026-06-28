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

const og = (side: 'home' | 'away', bucket: number): GoalFact => ({
  side,
  bucket,
  scorerId: null,
  assistId: null,
  ownGoal: true,
})

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

  test('2-0 vs 0-2: count only — spread differs (hh vs aa)', () => {
    const p = pred({ outcome: 'home', homeScore: 2, awayScore: 0, goals: [g('home', 1, 1), g('home', 2, 2)] })
    const r = result({ outcome: 'away', homeScore: 0, awayScore: 2, goals: [g('away', 5, 50), g('away', 6, 51)] })
    // 3 count only (outcome wrong, sequence hh≠aa, not exact)
    expect(scoreSubmission(p, r).total).toBe(3)
  })

  test('goal spread: correct team order earns it (1-1, home then away)', () => {
    const p = pred({ outcome: 'score-draw', homeScore: 1, awayScore: 1, goals: [g('home', 1), g('away', 3)] })
    const r = result({ outcome: 'score-draw', homeScore: 1, awayScore: 1, goals: [g('home', 5), g('away', 7)] })
    // 5 outcome + 3 count + 5 spread (ha==ha) + 10 exact; buckets differ ⇒ no timing/perfect
    expect(scoreSubmission(p, r).total).toBe(23)
  })

  test('goal spread: wrong team order forfeits it (1-1, away first vs home first)', () => {
    const p = pred({ outcome: 'score-draw', homeScore: 1, awayScore: 1, goals: [g('away', 1), g('home', 3)] })
    const r = result({ outcome: 'score-draw', homeScore: 1, awayScore: 1, goals: [g('home', 1), g('away', 3)] })
    // 5 outcome + 3 count + 10 exact, but spread ah≠ha ⇒ no 5 = 18
    expect(scoreSubmission(p, r).total).toBe(18)
  })

  test('perfect single-goal win', () => {
    const goal = g('home', 3, 10, 7)
    const p = pred({ outcome: 'home', homeScore: 1, awayScore: 0, goals: [goal] })
    const r = result({ outcome: 'home', homeScore: 1, awayScore: 0, goals: [g('home', 3, 10, 7)] })
    // 5+3+5+10 + timing5+scorer5 + assist5 + combo5 + 50 perfect = 93
    expect(scoreSubmission(p, r).total).toBe(93)
  })

  test('decoupled assist: correct assister credited even when its goal pairs elsewhere', () => {
    const p = pred({ outcome: 'home', homeScore: 2, awayScore: 0, goals: [g('home', 1, 10, 7), g('home', 8, 11, 8)] })
    const r = result({ outcome: 'home', homeScore: 2, awayScore: 0, goals: [g('home', 1, 10, 99), g('home', 8, 11, 7)] })
    // 23 scoreline + timing10 + scorer10 + assist5 (7 assisted, named); no combo (no scorer+assist pair matches)
    expect(scoreSubmission(p, r).total).toBe(48)
  })

  test('scorer + assister combo bonus (wrong minute, so no timing/perfect)', () => {
    const p = pred({ outcome: 'home', homeScore: 1, awayScore: 0, goals: [g('home', 5, 10, 7)] })
    const r = result({ outcome: 'home', homeScore: 1, awayScore: 0, goals: [g('home', 3, 10, 7)] })
    // 23 + scorer5 + assist5 + combo5 = 38
    expect(scoreSubmission(p, r).total).toBe(38)
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

  test('0-0 prediction on a non-0-0 game scores nothing (no possession/shots leak)', () => {
    const p = pred({ outcome: 'goalless-draw', homeScore: 0, awayScore: 0, possessionHome: 50, shotsHome: 10, shotsAway: 16 })
    // Game ended 0-4 with identical possession/shots — none of it should count.
    const r = result({ outcome: 'away', homeScore: 0, awayScore: 4, goals: [g('away', 1, 1), g('away', 2, 2), g('away', 3, 3), g('away', 4, 4)], possessionHome: 50, shotsHome: 10, shotsAway: 16 })
    expect(scoreSubmission(p, r).total).toBe(0)
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
    // 5+3+5+10 + timing10 + scorer10 + assist5 (one real assister) + combo5 + 50 = 103
    expect(scoreSubmission(p, r).total).toBe(103)
  })

  test('own goal: perfectly called (10 for OG, not 5)', () => {
    const p = pred({ outcome: 'home', homeScore: 1, awayScore: 0, goals: [og('home', 3)] })
    const r = result({ outcome: 'home', homeScore: 1, awayScore: 0, goals: [og('home', 3)] })
    // 23 scoreline + timing 5 + own-goal 10 + perfect 50 = 88
    expect(scoreSubmission(p, r).total).toBe(88)
  })

  test('own goal: right call, wrong bracket (no timing, no perfect)', () => {
    const p = pred({ outcome: 'home', homeScore: 1, awayScore: 0, goals: [og('home', 5)] })
    const r = result({ outcome: 'home', homeScore: 1, awayScore: 0, goals: [og('home', 3)] })
    // 23 + own-goal 10 = 33
    expect(scoreSubmission(p, r).total).toBe(33)
  })

  test('own goal predicted but it was a normal goal — no OG/scorer points', () => {
    const p = pred({ outcome: 'home', homeScore: 1, awayScore: 0, goals: [og('home', 3)] })
    const r = result({ outcome: 'home', homeScore: 1, awayScore: 0, goals: [g('home', 3, 10, 7)] })
    // 23 + timing 5 only (OG≠named scorer) = 28
    expect(scoreSubmission(p, r).total).toBe(28)
  })

  test('normal scorer predicted but it was an own goal — no scorer/OG points', () => {
    const p = pred({ outcome: 'home', homeScore: 1, awayScore: 0, goals: [g('home', 3, 10, 7)] })
    const r = result({ outcome: 'home', homeScore: 1, awayScore: 0, goals: [og('home', 3)] })
    // 23 + timing 5 only = 28
    expect(scoreSubmission(p, r).total).toBe(28)
  })

  test('extra-time winner: goal in ET first half (bucket 10) scored perfectly', () => {
    const p = pred({ outcome: 'home', homeScore: 1, awayScore: 0, goals: [g('home', 10, 9)] })
    const r = result({ outcome: 'home', homeScore: 1, awayScore: 0, goals: [g('home', 10, 9)] })
    // 23 scoreline + timing 5 + scorer 5 + perfect 50 = 83
    expect(scoreSubmission(p, r).total).toBe(83)
  })

  test('extra-time halves are distinct brackets (ET1 vs ET2 = no timing/perfect)', () => {
    const p = pred({ outcome: 'home', homeScore: 1, awayScore: 0, goals: [g('home', 10, 9)] })
    const r = result({ outcome: 'home', homeScore: 1, awayScore: 0, goals: [g('home', 11, 9)] })
    // 23 + scorer 5 only (wrong ET half → no timing, no perfect) = 28
    expect(scoreSubmission(p, r).total).toBe(28)
  })
})

describe('penalty shootout', () => {
  const drawPred = (penaltyWinner: 'home' | 'away' | null): Prediction =>
    pred({ outcome: 'score-draw', homeScore: 1, awayScore: 1, goals: [g('home', 2), g('away', 5)], penaltyWinner })
  const drawResult = (penaltyWinner: 'home' | 'away' | null): MatchResult =>
    result({ outcome: 'score-draw', homeScore: 1, awayScore: 1, goals: [g('home', 7, 9), g('away', 8, 50)], penaltyWinner })

  test('correct shootout winner adds 5', () => {
    // outcome 5 + count 3 + spread (ha) 5 + exact 10 + penalty 5 = 28
    const s = scoreSubmission(drawPred('home'), drawResult('home'))
    expect(s.total).toBe(28)
    expect(s.lines.some((l) => l.key === 'penalty')).toBe(true)
  })

  test('wrong shootout winner scores no penalty points', () => {
    const s = scoreSubmission(drawPred('away'), drawResult('home'))
    expect(s.total).toBe(23)
    expect(s.lines.some((l) => l.key === 'penalty')).toBe(false)
  })

  test('no shootout in the real match → no penalty points even if predicted', () => {
    // Predicted a draw + shootout winner, but the match was a home win.
    const p = drawPred('home')
    const r = result({ outcome: 'home', homeScore: 2, awayScore: 1, goals: [], penaltyWinner: null })
    expect(r.penaltyWinner).toBe(null)
    expect(scoreSubmission(p, r).lines.some((l) => l.key === 'penalty')).toBe(false)
  })

  test('no penalty prediction → no penalty points even if the match went to penalties', () => {
    const s = scoreSubmission(drawPred(null), drawResult('home'))
    expect(s.lines.some((l) => l.key === 'penalty')).toBe(false)
  })
})
