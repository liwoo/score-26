import { Navigate, Outlet, useParams } from 'react-router-dom'
import { getMatch } from '../../data/matches'
import { PredictionProvider } from './PredictionContext'

export function PredictionLayout() {
  const { matchId } = useParams()
  const match = matchId ? getMatch(matchId) : undefined

  if (!match) return <Navigate to="/matches" replace />
  if (match.status !== 'open') return <Navigate to="/matches" replace />

  return (
    <PredictionProvider match={match}>
      <Outlet />
    </PredictionProvider>
  )
}

export function StepDots({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-1.5 py-2">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`h-2 rounded-full border-2 border-ink transition-all ${
            i === step
              ? 'w-6 bg-coral'
              : i < step
                ? 'w-2 bg-grass'
                : 'w-2 bg-white'
          }`}
        />
      ))}
    </div>
  )
}
