import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { Screen } from '../../components/Screen'
import { PopButton } from '../../components/PopButton'
import { getMatch } from '../../data/matches'
import { MAX_PREDICTIONS } from '../../data/profile'
import { useSquad } from '../../data/useSquad'
import { predictionFromSubmission } from '../../data/scoringAdapters'
import {
  useMatchResult,
  useMySubmissions,
  type SubmissionRecord,
} from '../../data/useSubmissionsDetail'
import { BUCKETS } from '../../data/timeline'
import { useAuth } from '../../features/auth/AuthProvider'

const OUTCOME_LABEL: Record<string, string> = {
  home: 'Home win',
  away: 'Away win',
  'score-draw': 'Score draw',
  'goalless-draw': 'Goalless draw',
}

export function SubmissionDetailPage() {
  const navigate = useNavigate()
  const { matchId } = useParams()
  const { email } = useAuth()
  const match = matchId ? getMatch(matchId) : undefined

  const { data: subs = [], isLoading } = useMySubmissions(matchId, email)
  const { data: result } = useMatchResult(matchId)
  const { data: homeSquad = [] } = useSquad(match?.home.code)
  const { data: awaySquad = [] } = useSquad(match?.away.code)
  const playerById = new Map([...homeSquad, ...awaySquad].map((p) => [p.id, p]))

  if (!match) return <Navigate to="/settings" replace />

  const scored = result?.status === 'finished'
  const bestPoints = scored ? Math.max(0, ...subs.map((s) => s.points)) : -1
  const canPlay = match.status === 'open' && subs.length < MAX_PREDICTIONS

  const Attempt = ({ rec }: { rec: SubmissionRecord }) => {
    const p = predictionFromSubmission(rec, rec.submission_goals)
    const goals = [...rec.submission_goals]
      .filter((g) => g.scorer_player_id != null)
      .sort((a, b) => a.bucket - b.bucket)
    const isBest = scored && rec.points === bestPoints && bestPoints > 0

    return (
      <div className="rounded-3xl border-[3px] border-ink bg-white p-4 shadow-pop-lg">
        <div className="flex items-center justify-between">
          <span className="font-display text-sm text-ink/50">
            Attempt {rec.attempt}/{MAX_PREDICTIONS}
            {isBest && (
              <span className="ml-2 rounded-full border-2 border-ink bg-grass px-2 py-px text-[10px] font-extrabold text-white">
                BEST
              </span>
            )}
          </span>
          <span
            className={`rounded-full border-2 border-ink px-2.5 py-0.5 font-display text-sm shadow-pop ${
              scored ? 'bg-sun' : 'bg-ink/10 text-ink/50'
            }`}
          >
            {scored ? `${rec.points} pts` : 'Pending'}
          </span>
        </div>

        <div className="mt-2 flex items-center justify-center gap-3">
          <span className="text-2xl">{match.home.flag}</span>
          <span className="font-display text-3xl">
            {p.homeScore} – {p.awayScore}
          </span>
          <span className="text-2xl">{match.away.flag}</span>
        </div>
        <p className="text-center text-xs font-extrabold uppercase tracking-wider text-ink/40">
          {OUTCOME_LABEL[rec.outcome]}
        </p>

        {rec.outcome === 'goalless-draw' ? (
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <Stat label="Possession" value={`${rec.possession_home ?? 0}%`} />
            <Stat label={`${match.home.code} shots`} value={rec.shots_home ?? 0} />
            <Stat label={`${match.away.code} shots`} value={rec.shots_away ?? 0} />
          </div>
        ) : goals.length > 0 ? (
          <ul className="mt-3 space-y-1.5">
            {goals.map((g, i) => {
              const team = g.side === 'home' ? match.home : match.away
              const scorer = g.scorer_player_id
                ? playerById.get(String(g.scorer_player_id))
                : undefined
              const assister = g.assist_player_id
                ? playerById.get(String(g.assist_player_id))
                : undefined
              return (
                <li
                  key={i}
                  className="flex items-center gap-2 rounded-xl border-2 border-ink/10 bg-cream px-3 py-1.5"
                >
                  <span className="w-12 font-display text-sm text-ink/50">
                    {BUCKETS[g.bucket]?.label ?? ''}
                  </span>
                  <span className="text-lg">{team.flag}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold leading-tight">
                      ⚽ {scorer?.name ?? '—'}
                    </span>
                    <span className="block truncate text-xs font-bold text-ink/50">
                      🅰️ {assister ? assister.name : 'solo goal'}
                    </span>
                  </span>
                </li>
              )
            })}
          </ul>
        ) : null}

        <p className="mt-2 text-center text-[11px] font-bold text-ink/35">
          Submitted {new Date(rec.created_at).toLocaleString()}
        </p>
      </div>
    )
  }

  return (
    <Screen title="My Submissions" onBack={() => navigate('/settings')}>
      <div className="space-y-4 p-4">
        {/* Match header */}
        <div className="rounded-3xl border-[3px] border-ink bg-white p-4 text-center shadow-pop-lg">
          <p className="text-xs font-extrabold uppercase tracking-wider text-ink/50">
            {match.group}
          </p>
          <div className="mt-1 flex items-center justify-center gap-3">
            <span className="text-2xl">{match.home.flag}</span>
            <span className="font-display text-lg">
              {match.home.code} v {match.away.code}
            </span>
            <span className="text-2xl">{match.away.flag}</span>
          </div>
          {scored && result ? (
            <p className="mt-2 inline-block rounded-full border-2 border-ink bg-grass px-3 py-0.5 font-display text-sm text-white">
              Full-time {result.home_score} – {result.away_score}
            </p>
          ) : (
            <p className="mt-2 text-xs font-bold text-ink/50">
              {match.status === 'finished'
                ? 'Awaiting official result — scores post soon.'
                : 'Scores are awarded at full-time. ⏱️'}
            </p>
          )}
        </div>

        {isLoading && (
          <p className="py-8 text-center font-bold text-ink/40">Loading…</p>
        )}

        {!isLoading && subs.length === 0 && (
          <p className="py-8 text-center font-bold text-ink/40">
            No submissions for this match yet.
          </p>
        )}

        {subs.map((rec) => (
          <Attempt key={rec.id} rec={rec} />
        ))}

        {canPlay && (
          <PopButton variant="coral" full onClick={() => navigate(`/play/${match.id}`)}>
            🎯 Predict again ({MAX_PREDICTIONS - subs.length} left)
          </PopButton>
        )}
      </div>
    </Screen>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border-2 border-ink/10 bg-cream px-2 py-2">
      <p className="font-display text-xl">{value}</p>
      <p className="text-[10px] font-extrabold uppercase tracking-wide text-ink/50">
        {label}
      </p>
    </div>
  )
}
