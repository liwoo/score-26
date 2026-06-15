import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react'
import type { Match, Team } from '../../data/types'

/** sessionStorage key for a match's in-progress draft (survives OAuth redirect). */
const draftKey = (matchId: string) => `score26:draft:${matchId}`

// eslint-disable-next-line react-refresh/only-export-components
export function clearDraft(matchId: string) {
  try {
    sessionStorage.removeItem(draftKey(matchId))
  } catch {
    /* ignore */
  }
}

export type Side = 'home' | 'away'
export type Outcome = Side | 'score-draw' | 'goalless-draw'

/** Sentinel assist value meaning the goal was a solo effort (no assist). */
export const NO_ASSIST = '__none__'

/** Sentinel scorer value meaning an own goal — no named scorer, no assist. */
export const OWN_GOAL = '__og__'

export type GoalPick = {
  id: string
  side: Side
  /** Index into BUCKETS, or null until dropped onto the timeline. */
  bucket: number | null
  /** Player id of the predicted scorer, or null until chosen. */
  scorerId: string | null
  /** Player id of the predicted assister, NO_ASSIST, or null until chosen. */
  assistId: string | null
}

type State = {
  outcome: Outcome | null
  /** Team win: winner's goals. Score draw: goals for each side. */
  winnerGoals: number | null
  /** Team win: loser's goals. Draws: unused. */
  loserGoals: number | null
  goals: GoalPick[]
  /** Scoreless-draw extras (no timeline) — home's possession %, away = 100 - it. */
  possessionHome: number
  /** Total shots predicted for each side. */
  shotsHome: number
  shotsAway: number
}

type Action =
  | { type: 'setOutcome'; outcome: Outcome }
  | { type: 'setWinnerGoals'; n: number }
  | { type: 'setLoserGoals'; n: number }
  | { type: 'buildGoals' }
  | { type: 'placeGoal'; goalId: string; bucket: number | null }
  | { type: 'setScorer'; goalId: string; scorerId: string }
  | { type: 'setAssist'; goalId: string; assistId: string }
  | { type: 'setPossession'; home: number }
  | { type: 'setShotsHome'; n: number }
  | { type: 'setShotsAway'; n: number }
  | { type: 'reset' }

const initial: State = {
  outcome: null,
  winnerGoals: null,
  loserGoals: null,
  goals: [],
  possessionHome: 50,
  shotsHome: 8,
  shotsAway: 7,
}

function buildGoals(state: State): GoalPick[] {
  if (!state.outcome) return []
  const make = (side: Side, n: number): GoalPick[] =>
    Array.from({ length: n }, (_, i) => ({
      id: `${side}-${i}`,
      side,
      bucket: null,
      scorerId: null,
      assistId: null,
    }))

  if (state.outcome === 'goalless-draw') return []
  if (state.outcome === 'score-draw') {
    const n = state.winnerGoals ?? 0
    return [...make('home', n), ...make('away', n)]
  }
  // team win
  const winner = state.outcome
  const loser: Side = winner === 'home' ? 'away' : 'home'
  return [
    ...make(winner, state.winnerGoals ?? 0),
    ...make(loser, state.loserGoals ?? 0),
  ]
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'setOutcome':
      return { ...initial, outcome: action.outcome }
    case 'setWinnerGoals':
      return { ...state, winnerGoals: action.n, loserGoals: null, goals: [] }
    case 'setLoserGoals':
      return { ...state, loserGoals: action.n, goals: [] }
    case 'buildGoals':
      return { ...state, goals: buildGoals(state) }
    case 'placeGoal':
      return {
        ...state,
        goals: state.goals.map((g) =>
          g.id === action.goalId ? { ...g, bucket: action.bucket } : g,
        ),
      }
    case 'setScorer':
      return {
        ...state,
        goals: state.goals.map((g) =>
          g.id === action.goalId
            ? {
                ...g,
                scorerId: action.scorerId,
                // Own goals have no assist (auto-complete that step). Otherwise a
                // scorer can't also be their own assister.
                assistId:
                  action.scorerId === OWN_GOAL
                    ? NO_ASSIST
                    : g.assistId === action.scorerId
                      ? null
                      : g.assistId,
              }
            : g,
        ),
      }
    case 'setAssist':
      return {
        ...state,
        goals: state.goals.map((g) =>
          g.id === action.goalId ? { ...g, assistId: action.assistId } : g,
        ),
      }
    case 'setPossession':
      return { ...state, possessionHome: action.home }
    case 'setShotsHome':
      return { ...state, shotsHome: action.n }
    case 'setShotsAway':
      return { ...state, shotsAway: action.n }
    case 'reset':
      return initial
    default:
      return state
  }
}

type PredictionContextValue = {
  state: State
  match: Match
  /** The winning side for a team-win outcome, else null. */
  winnerSide: Side | null
  loserSide: Side | null
  winnerTeam: Team | null
  loserTeam: Team | null
  isDraw: boolean
  scoreline: string | null
  allPlaced: boolean
  allScored: boolean
  allAssisted: boolean
  setOutcome: (o: Outcome) => void
  setWinnerGoals: (n: number) => void
  setLoserGoals: (n: number) => void
  buildGoals: () => void
  placeGoal: (goalId: string, bucket: number | null) => void
  setScorer: (goalId: string, scorerId: string) => void
  setAssist: (goalId: string, assistId: string) => void
  setPossession: (home: number) => void
  setShotsHome: (n: number) => void
  setShotsAway: (n: number) => void
  reset: () => void
}

const Ctx = createContext<PredictionContextValue | null>(null)

export function PredictionProvider({
  match,
  children,
}: {
  match: Match
  children: ReactNode
}) {
  const [state, dispatch] = useReducer(reducer, initial, (init) => {
    // Rehydrate a draft saved before a Google sign-in redirect.
    try {
      const raw = sessionStorage.getItem(draftKey(match.id))
      return raw ? (JSON.parse(raw) as State) : init
    } catch {
      return init
    }
  })

  // Persist the draft so an OAuth round-trip doesn't lose the prediction.
  useEffect(() => {
    try {
      if (state.outcome) {
        sessionStorage.setItem(draftKey(match.id), JSON.stringify(state))
      }
    } catch {
      /* ignore quota/serialization errors */
    }
  }, [state, match.id])

  const value = useMemo<PredictionContextValue>(() => {
    const winnerSide: Side | null =
      state.outcome === 'home' || state.outcome === 'away'
        ? state.outcome
        : null
    const loserSide: Side | null = winnerSide
      ? winnerSide === 'home'
        ? 'away'
        : 'home'
      : null
    const isDraw =
      state.outcome === 'score-draw' || state.outcome === 'goalless-draw'

    const teamOf = (side: Side | null) =>
      side === 'home' ? match.home : side === 'away' ? match.away : null

    let scoreline: string | null = null
    if (state.outcome === 'goalless-draw') scoreline = '0 – 0'
    else if (state.outcome === 'score-draw' && state.winnerGoals != null)
      scoreline = `${state.winnerGoals} – ${state.winnerGoals}`
    else if (
      winnerSide &&
      state.winnerGoals != null &&
      state.loserGoals != null
    ) {
      const h = winnerSide === 'home' ? state.winnerGoals : state.loserGoals
      const a = winnerSide === 'away' ? state.winnerGoals : state.loserGoals
      scoreline = `${h} – ${a}`
    }

    const allPlaced =
      state.goals.length > 0 && state.goals.every((g) => g.bucket != null)
    const allScored =
      state.goals.length > 0 && state.goals.every((g) => g.scorerId != null)
    const allAssisted =
      state.goals.length > 0 && state.goals.every((g) => g.assistId != null)

    return {
      state,
      match,
      winnerSide,
      loserSide,
      winnerTeam: teamOf(winnerSide),
      loserTeam: teamOf(loserSide),
      isDraw,
      scoreline,
      allPlaced,
      allScored,
      allAssisted,
      setOutcome: (o) => dispatch({ type: 'setOutcome', outcome: o }),
      setWinnerGoals: (n) => dispatch({ type: 'setWinnerGoals', n }),
      setLoserGoals: (n) => dispatch({ type: 'setLoserGoals', n }),
      buildGoals: () => dispatch({ type: 'buildGoals' }),
      placeGoal: (goalId, bucket) =>
        dispatch({ type: 'placeGoal', goalId, bucket }),
      setScorer: (goalId, scorerId) =>
        dispatch({ type: 'setScorer', goalId, scorerId }),
      setAssist: (goalId, assistId) =>
        dispatch({ type: 'setAssist', goalId, assistId }),
      setPossession: (home) => dispatch({ type: 'setPossession', home }),
      setShotsHome: (n) => dispatch({ type: 'setShotsHome', n }),
      setShotsAway: (n) => dispatch({ type: 'setShotsAway', n }),
      reset: () => dispatch({ type: 'reset' }),
    }
  }, [state, match])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePrediction() {
  const ctx = useContext(Ctx)
  if (!ctx)
    throw new Error('usePrediction must be used within a PredictionProvider')
  return ctx
}
