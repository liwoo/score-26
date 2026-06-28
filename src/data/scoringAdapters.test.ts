import { expect, test, describe } from 'bun:test'
import { predictionFromSubmission, resultFromRows } from './scoringAdapters'

describe('predictionFromSubmission', () => {
  test('home win maps winner→home, loser→away', () => {
    const p = predictionFromSubmission(
      { outcome: 'home', winner_goals: 3, loser_goals: 1, possession_home: null, shots_home: null, shots_away: null, penalty_winner: null },
      [],
    )
    expect([p.homeScore, p.awayScore]).toEqual([3, 1])
  })

  test('away win maps winner→away, loser→home', () => {
    const p = predictionFromSubmission(
      { outcome: 'away', winner_goals: 2, loser_goals: 0, possession_home: null, shots_home: null, shots_away: null, penalty_winner: null },
      [],
    )
    expect([p.homeScore, p.awayScore]).toEqual([0, 2])
  })

  test('score-draw gives equal scores', () => {
    const p = predictionFromSubmission(
      { outcome: 'score-draw', winner_goals: 2, loser_goals: null, possession_home: null, shots_home: null, shots_away: null, penalty_winner: null },
      [],
    )
    expect([p.homeScore, p.awayScore]).toEqual([2, 2])
  })

  test('goalless-draw carries possession/shots', () => {
    const p = predictionFromSubmission(
      { outcome: 'goalless-draw', winner_goals: null, loser_goals: null, possession_home: 55, shots_home: 9, shots_away: 6, penalty_winner: null },
      [],
    )
    expect([p.homeScore, p.awayScore]).toEqual([0, 0])
    expect(p.possessionHome).toBe(55)
    expect([p.shotsHome, p.shotsAway]).toEqual([9, 6])
  })

  test('maps goal rows to GoalFacts', () => {
    const p = predictionFromSubmission(
      { outcome: 'home', winner_goals: 1, loser_goals: 0, possession_home: null, shots_home: null, shots_away: null, penalty_winner: null },
      [{ side: 'home', bucket: 3, scorer_player_id: 10, assist_player_id: 7 }],
    )
    expect(p.goals[0]).toEqual({ side: 'home', bucket: 3, scorerId: 10, assistId: 7, ownGoal: false })
  })

  test('maps an own-goal row', () => {
    const p = predictionFromSubmission(
      { outcome: 'home', winner_goals: 1, loser_goals: 0, possession_home: null, shots_home: null, shots_away: null, penalty_winner: null },
      [{ side: 'home', bucket: 3, scorer_player_id: null, assist_player_id: null, own_goal: true }],
    )
    expect(p.goals[0]).toEqual({ side: 'home', bucket: 3, scorerId: null, assistId: null, ownGoal: true })
  })

  test('carries the predicted penalty winner on a knockout draw', () => {
    const p = predictionFromSubmission(
      { outcome: 'score-draw', winner_goals: 1, loser_goals: null, possession_home: null, shots_home: null, shots_away: null, penalty_winner: 'away' },
      [],
    )
    expect(p.penaltyWinner).toBe('away')
  })
})

describe('resultFromRows', () => {
  test('defaults possession/shots when null', () => {
    const r = resultFromRows(
      { outcome: 'home', home_score: 1, away_score: 0, possession_home: null, shots_home: null, shots_away: null, penalty_winner: null },
      [],
    )
    expect(r.possessionHome).toBe(50)
    expect([r.shotsHome, r.shotsAway]).toEqual([0, 0])
  })

  test('carries the actual penalty winner', () => {
    const r = resultFromRows(
      { outcome: 'score-draw', home_score: 1, away_score: 1, possession_home: null, shots_home: null, shots_away: null, penalty_winner: 'home' },
      [],
    )
    expect(r.penaltyWinner).toBe('home')
  })
})
