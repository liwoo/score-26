import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Screen } from '../../components/Screen'
import { ShareButton } from '../../components/ShareButton'
import { Avatar } from '../../components/Avatar'
import { Flag } from '../../components/Flag'
import { PopButton } from '../../components/PopButton'
import { BUCKETS } from '../../data/timeline'
import { useSquad } from '../../data/useSquad'
import {
  COUNTRIES,
  SEEDS,
  MAX_PREDICTIONS,
  type Country,
} from '../../data/profile'
import { getAttemptCount, saveSubmission } from '../../data/submissions'
import { useAuth } from '../../features/auth/AuthProvider'
import {
  usePrediction,
  clearDraft,
  NO_ASSIST,
} from '../../features/prediction/PredictionContext'

export function SubmitStep() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { state, match, scoreline, isDraw } = usePrediction()
  const { user, email, profile, loading, signInWithGoogle, saveProfile } =
    useAuth()

  // Profile-setup fields (only used by brand-new players).
  const [username, setUsername] = useState('')
  const [seedIdx, setSeedIdx] = useState(0)
  const [country, setCountry] = useState(COUNTRIES[0])

  // Smoother setup: prefill the username from the Google account once.
  const [prefilled, setPrefilled] = useState(false)
  if (!prefilled && !profile && user && username === '') {
    const meta = user.user_metadata ?? {}
    const guess = String(meta.given_name || meta.name || meta.full_name || '')
      .trim()
      .split(' ')[0]
      .replace(/[^A-Za-z0-9_]/g, '')
      .slice(0, 16)
    setPrefilled(true)
    if (guess.length >= 3) setUsername(guess)
  }

  // Squads (for resolving scorer/assist names) come from the API.
  const { data: homeSquad = [] } = useSquad(match.home.code)
  const { data: awaySquad = [] } = useSquad(match.away.code)
  const playerById = new Map([...homeSquad, ...awaySquad].map((p) => [p.id, p]))

  const { data: attemptCount = 0 } = useQuery({
    queryKey: ['attempts', email, match.id],
    enabled: !!email,
    queryFn: () => getAttemptCount(email!, match.id),
  })

  const submitMut = useMutation({
    mutationFn: async () => {
      const newSignup = !profile
      // New player: create their profile first (trigger seats them at 0 on the board).
      let prof: { username: string; avatarSeed: string; country: Country }
      if (profile) {
        prof = {
          username: profile.username,
          avatarSeed: profile.avatarSeed,
          country: profile.country,
        }
      } else {
        await saveProfile({
          username: username.trim(),
          avatarSeed: SEEDS[seedIdx],
          countryIso: country.iso,
        })
        prof = { username: username.trim(), avatarSeed: SEEDS[seedIdx], country }
      }
      const n = await saveSubmission(email!, match, state)
      return { n, prof, newSignup }
    },
    onSuccess: ({ n, prof, newSignup }) => {
      clearDraft(match.id)
      qc.invalidateQueries({ queryKey: ['attempts', email, match.id] })
      qc.invalidateQueries({ queryKey: ['leaderboard'] })
      navigate('/done', {
        state: {
          username: prof.username,
          seed: prof.avatarSeed,
          country: prof.country,
          predictionNo: n,
          newSignup,
          email,
          matchLabel: `${match.home.name} v ${match.away.name}`,
        },
      })
    },
  })

  if (!state.outcome) return <Navigate to=".." replace />

  const scoredGoals = [...state.goals]
    .filter((g) => g.bucket != null)
    .sort((a, b) => (a.bucket ?? 0) - (b.bucket ?? 0))

  const signedIn = !!email
  const needsProfile = signedIn && !profile
  const reachedLimit = signedIn && attemptCount >= MAX_PREDICTIONS
  const canSubmitNew = needsProfile ? username.trim().length >= 3 : true

  return (
    <Screen title="Lock It In" onBack={() => navigate(-1)} right={<ShareButton />}>
      <div className="space-y-4 p-4">
        {/* Summary */}
        <div className="rounded-3xl border-[3px] border-ink bg-white p-4 shadow-pop-lg">
          <div className="flex items-center justify-center gap-3">
            <span className="text-3xl">{match.home.flag}</span>
            <span className="font-display text-4xl">{scoreline ?? '—'}</span>
            <span className="text-3xl">{match.away.flag}</span>
          </div>
          <p className="mt-1 text-center text-xs font-extrabold uppercase tracking-wider text-ink/50">
            {match.home.code} v {match.away.code}
          </p>

          {state.outcome === 'goalless-draw' ? (
            <div className="mt-3 space-y-2">
              <p className="text-center text-sm font-bold text-ink/60">
                Clean sheet both ends — judged on the game stats. 🧤
              </p>
              <div>
                <div className="mb-1 flex justify-between text-xs font-extrabold text-ink/60">
                  <span>
                    {match.home.flag} {state.possessionHome}%
                  </span>
                  <span>
                    {100 - state.possessionHome}% {match.away.flag}
                  </span>
                </div>
                <div className="flex h-5 overflow-hidden rounded-full border-2 border-ink">
                  <div
                    style={{
                      width: `${state.possessionHome}%`,
                      backgroundColor: match.home.color,
                    }}
                  />
                  <div
                    className="flex-1"
                    style={{ backgroundColor: match.away.color }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { team: match.home, value: state.shotsHome },
                  { team: match.away, value: state.shotsAway },
                ].map(({ team, value }) => (
                  <div
                    key={team.id}
                    className="rounded-xl border-2 border-ink/10 bg-cream px-3 py-2 text-center"
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <Flag iso={team.iso} size={16} shadow={false} />
                      <span className="font-display text-2xl">{value}</span>
                    </div>
                    <p className="text-[10px] font-extrabold uppercase tracking-wide text-ink/50">
                      {team.code} shots
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : scoredGoals.length === 0 ? (
            <button
              onClick={() => navigate('../timeline')}
              className="mt-3 w-full rounded-2xl border-2 border-dashed border-ink/30 bg-cream px-3 py-3 text-center text-sm font-bold text-ink/55 active:bg-ink/5"
            >
              Scoreline only — tap to add goal times & scorers for bonus points ⚽
            </button>
          ) : (
            <ul className="mt-3 space-y-1.5">
              {scoredGoals.map((g) => {
                const team = g.side === 'home' ? match.home : match.away
                const scorer = g.scorerId ? playerById.get(g.scorerId) : undefined
                const assister =
                  g.assistId && g.assistId !== NO_ASSIST
                    ? playerById.get(g.assistId)
                    : null
                const label = g.bucket != null ? BUCKETS[g.bucket].label : ''
                return (
                  <li
                    key={g.id}
                    className="flex items-center gap-2 rounded-xl border-2 border-ink/10 bg-cream px-3 py-1.5"
                  >
                    <span className="w-12 font-display text-sm text-ink/50">
                      {label}
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
                    <span className="rounded-full border-2 border-ink bg-sun px-2 py-px font-display text-xs">
                      +{scorer?.points ?? 0}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
          {isDraw && state.outcome === 'score-draw' && (
            <p className="mt-2 text-center text-xs font-bold text-ink/40">
              Honours even — nice and risky. 🤝
            </p>
          )}
          {match.knockout && isDraw && state.penaltyWinner && (
            <div className="mt-3 flex items-center justify-center gap-2 rounded-2xl border-2 border-ink/10 bg-grape/10 px-3 py-2 text-center text-sm font-bold text-ink/70">
              <span className="text-lg">🥅</span>
              <span>
                {(state.penaltyWinner === 'home' ? match.home : match.away).name}{' '}
                to win on penalties
              </span>
            </div>
          )}
        </div>

        {/* Auth + quota */}
        {loading ? (
          <div className="rounded-3xl border-[3px] border-ink bg-white p-6 text-center font-bold text-ink/40 shadow-pop-lg">
            Checking your session…
          </div>
        ) : !signedIn ? (
          <div className="rounded-3xl border-[3px] border-ink bg-grape/10 p-4 text-center shadow-pop-lg">
            <p className="font-display text-xl">Sign in to submit 🔐</p>
            <p className="mt-1 text-sm font-bold text-ink/60">
              Continue with Google to save your prediction and join the board.
              Your picks are kept while you sign in.
            </p>
            <button
              onClick={() => signInWithGoogle()}
              className="mt-4 flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-ink bg-white px-4 py-3 font-display text-lg shadow-pop active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
            >
              <GoogleG /> Continue with Google
            </button>
          </div>
        ) : needsProfile ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4 rounded-3xl border-[3px] border-ink bg-white p-4 shadow-pop-lg"
          >
            <p className="text-center font-display text-xl">Make it yours ✨</p>
            <p className="truncate text-center text-xs font-bold text-ink/50">
              Signed in as {email}
            </p>

            <div className="flex flex-col items-center gap-2">
              <Avatar seed={SEEDS[seedIdx]} size={84} />
              <button
                onClick={() => setSeedIdx((i) => (i + 1) % SEEDS.length)}
                className="rounded-full border-2 border-ink bg-sun px-3 py-1 text-sm font-extrabold shadow-pop active:translate-y-[2px] active:shadow-none"
              >
                🎲 Shuffle avatar
              </button>
            </div>

            <label className="block">
              <span className="text-xs font-extrabold uppercase tracking-wider text-ink/50">
                Username
              </span>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. GoalGremlin"
                maxLength={16}
                className="mt-1 w-full rounded-2xl border-2 border-ink bg-cream px-4 py-2.5 font-display text-lg outline-none focus:bg-white"
              />
            </label>

            <div>
              <span className="text-xs font-extrabold uppercase tracking-wider text-ink/50">
                Country
              </span>
              <div className="no-scrollbar mt-1 flex gap-2 overflow-x-auto pb-1">
                {COUNTRIES.map((c) => (
                  <button
                    key={c.name}
                    onClick={() => setCountry(c)}
                    className={`flex shrink-0 items-center gap-1.5 rounded-full border-2 border-ink px-3 py-1.5 text-sm font-bold ${
                      country.name === c.name ? 'bg-ink text-cream' : 'bg-white'
                    }`}
                  >
                    <Flag iso={c.iso} size={18} shadow={false} />
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        ) : (
          <div className="rounded-3xl border-[3px] border-ink bg-white p-4 shadow-pop-lg">
            <div className="flex items-center gap-3">
              <Avatar seed={profile!.avatarSeed} size={48} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-lg leading-tight">
                  {profile!.username}
                </p>
                <p className="flex items-center gap-1.5 text-xs font-bold text-ink/50">
                  <Flag iso={profile!.country.iso} size={14} shadow={false} />
                  Signed in
                </p>
              </div>
            </div>
            <div
              className={`mt-3 rounded-2xl border-2 px-3 py-2 text-center text-sm font-bold ${
                reachedLimit
                  ? 'border-coral/40 bg-coral/10 text-coral'
                  : 'border-ink/10 bg-cream text-ink/60'
              }`}
            >
              {reachedLimit
                ? '🔒 All 3 predictions used for this match — we keep your highest.'
                : `Prediction ${attemptCount + 1} of ${MAX_PREDICTIONS} · we score your best one.`}
            </div>
          </div>
        )}

        {submitMut.isError && (
          <p className="text-center text-sm font-bold text-coral">
            Couldn’t save — {(submitMut.error as Error).message}. Try again.
          </p>
        )}

        {/* Action */}
        {!loading && signedIn ? (
          reachedLimit ? (
            <PopButton variant="ghost" full onClick={() => navigate('/matches')}>
              ← Back to Matches
            </PopButton>
          ) : (
            <PopButton
              variant="coral"
              full
              className="text-xl"
              disabled={!canSubmitNew || submitMut.isPending}
              onClick={() => submitMut.mutate()}
            >
              {submitMut.isPending
                ? 'Saving…'
                : needsProfile
                  ? '🚀 Submit & Join'
                  : '🚀 Submit Prediction'}
            </PopButton>
          )
        ) : null}
      </div>
    </Screen>
  )
}

function GoogleG() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.4 30.1 0 24 0 14.6 0 6.4 5.4 2.5 13.3l7.8 6.1C12.2 13.2 17.6 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.4 5.7c4.3-4 6.8-9.9 6.8-17.4z" />
      <path fill="#FBBC05" d="M10.3 28.6c-.5-1.5-.8-3-.8-4.6s.3-3.1.8-4.6l-7.8-6.1C.9 16.5 0 20.1 0 24s.9 7.5 2.5 10.7l7.8-6.1z" />
      <path fill="#34A853" d="M24 48c6.1 0 11.3-2 15-5.5l-7.4-5.7c-2 1.4-4.7 2.3-7.6 2.3-6.4 0-11.8-3.7-13.7-9.1l-7.8 6.1C6.4 42.6 14.6 48 24 48z" />
    </svg>
  )
}
