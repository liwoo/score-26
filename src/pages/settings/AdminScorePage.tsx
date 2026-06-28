import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { Screen } from '../../components/Screen'
import { PopButton } from '../../components/PopButton'
import { getMatch } from '../../data/matches'
import { useSquad } from '../../data/useSquad'
import { supabase } from '../../lib/supabase'
import type { Player, Team } from '../../data/types'
import { useAuth } from '../../features/auth/AuthProvider'
import { isAdmin } from '../../features/auth/admin'

type Side = 'home' | 'away'
/** et: '' = regulation, '1' = ET 90–105', '2' = ET 105–120' (knockout only). */
type GoalRow = { side: Side; no: string; min: string; assistNo: string; ownGoal: boolean; et: '' | '1' | '2' }
type ScorerJson = {
  no?: number
  min: number
  assist_no?: number | null
  own_goal?: boolean
  /** Extra-time half: 1 = ET 90–105', 2 = ET 105–120'. Absent for regulation. */
  et?: number | null
}

/** Sentinel <option> value for the scorer dropdown meaning "own goal". */
const OG_OPTION = '__og__'

export function AdminScorePage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { matchId } = useParams()
  const { email, loading } = useAuth()
  const match = matchId ? getMatch(matchId) : undefined

  const { data: homeSquad = [] } = useSquad(match?.home.code)
  const { data: awaySquad = [] } = useSquad(match?.away.code)

  const { data: existing } = useQuery({
    queryKey: ['admin-outcome', matchId],
    enabled: isAdmin(email) && !!matchId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('match_outcomes')
        .select(
          'home_scorers, away_scorers, home_possession, home_shots, away_shots, penalty_winner',
        )
        .eq('match_id', Number(matchId))
        .maybeSingle()
      if (error) throw error
      return data as {
        home_scorers: ScorerJson[]
        away_scorers: ScorerJson[]
        home_possession: number | null
        home_shots: number | null
        away_shots: number | null
        penalty_winner: 'home' | 'away' | null
      } | null
    },
  })

  const [goals, setGoals] = useState<GoalRow[]>([])
  const [possessionHome, setPossessionHome] = useState('')
  const [shotsHome, setShotsHome] = useState('')
  const [shotsAway, setShotsAway] = useState('')
  const [penaltyWinner, setPenaltyWinner] = useState<'' | 'home' | 'away'>('')
  const [confirming, setConfirming] = useState(false)
  const [done, setDone] = useState(false)
  const [prefilledKey, setPrefilledKey] = useState<string | null>(null)

  // Prefill from an existing outcome the first time it loads. Render-time sync
  // (guarded so it runs once per match) rather than an effect — see GoalModal.
  if (existing && prefilledKey !== matchId) {
    const toRows = (arr: ScorerJson[], side: Side): GoalRow[] =>
      (arr ?? []).map((g) => ({
        side,
        no: g.own_goal || g.no == null ? '' : String(g.no),
        min: String(g.min),
        assistNo: g.assist_no == null ? '' : String(g.assist_no),
        ownGoal: !!g.own_goal,
        et: g.et === 1 ? '1' : g.et === 2 ? '2' : '',
      }))
    setPrefilledKey(matchId ?? null)
    setGoals([...toRows(existing.home_scorers, 'home'), ...toRows(existing.away_scorers, 'away')])
    setPossessionHome(existing.home_possession == null ? '' : String(existing.home_possession))
    setShotsHome(existing.home_shots == null ? '' : String(existing.home_shots))
    setShotsAway(existing.away_shots == null ? '' : String(existing.away_shots))
    setPenaltyWinner(existing.penalty_winner ?? '')
  }

  const save = useMutation({
    mutationFn: async () => {
      // Only carry the extra-time half for knockout fixtures (groups never go to ET).
      const etOf = (g: GoalRow) =>
        match!.knockout && (g.et === '1' || g.et === '2') ? { et: Number(g.et) } : {}
      const build = (side: Side): ScorerJson[] =>
        goals
          .filter((g) => g.side === side && g.min !== '' && (g.ownGoal || g.no !== ''))
          .map((g) =>
            g.ownGoal
              ? { min: Number(g.min), own_goal: true, ...etOf(g) }
              : {
                  no: Number(g.no),
                  min: Number(g.min),
                  assist_no: g.assistNo === '' ? null : Number(g.assistNo),
                  ...etOf(g),
                },
          )
      const homeGoals = build('home')
      const awayGoals = build('away')
      // Penalties only decide a knockout that's level after (extra) time.
      const drawn = homeGoals.length === awayGoals.length
      const penalty =
        match!.knockout && drawn && penaltyWinner !== '' ? penaltyWinner : null
      const { error } = await supabase.from('match_outcomes').upsert(
        {
          match_id: Number(matchId),
          home_code: match!.home.code,
          away_code: match!.away.code,
          home_scorers: homeGoals,
          away_scorers: awayGoals,
          home_possession: possessionHome === '' ? null : Number(possessionHome),
          home_shots: shotsHome === '' ? null : Number(shotsHome),
          away_shots: shotsAway === '' ? null : Number(shotsAway),
          penalty_winner: penalty,
          status: 'final',
        },
        { onConflict: 'match_id' },
      )
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-outcomes'] })
      setConfirming(false)
      setDone(true)
    },
  })

  if (loading) return null
  if (!isAdmin(email)) return <Navigate to="/settings" replace />
  if (!match) return <Navigate to="/settings/admin" replace />

  const filled = (g: GoalRow) => !!g.min && (g.ownGoal || !!g.no)
  const homeCount = goals.filter((g) => g.side === 'home' && filled(g)).length
  const awayCount = goals.filter((g) => g.side === 'away' && filled(g)).length
  const incomplete = goals.some((g) => !filled(g))
  // A level knockout went to penalties — the admin must record the winner.
  const knockoutDraw = match.knockout && homeCount === awayCount
  const needsPenalty = knockoutDraw && penaltyWinner === ''

  const addGoal = (side: Side) =>
    setGoals((g) => [...g, { side, no: '', min: '', assistNo: '', ownGoal: false, et: '' }])
  const update = (i: number, patch: Partial<GoalRow>) =>
    setGoals((g) => g.map((row, j) => (j === i ? { ...row, ...patch } : row)))
  const remove = (i: number) => setGoals((g) => g.filter((_, j) => j !== i))

  const squadOf = (side: Side) => (side === 'home' ? homeSquad : awaySquad)
  const teamOf = (side: Side): Team => (side === 'home' ? match.home : match.away)

  if (done) {
    return (
      <Screen title="Recorded" onBack={() => navigate('/settings/admin')}>
        <div className="grid h-full place-items-center p-6 text-center">
          <div>
            <div className="text-6xl">✅</div>
            <h2 className="mt-3 font-display text-2xl">Result saved!</h2>
            <p className="mx-auto mt-2 max-w-xs text-sm font-bold text-ink/60">
              {match.home.code} {homeCount}–{awayCount} {match.away.code}. Scoring
              and result emails are running in the background.
            </p>
            <PopButton
              variant="grass"
              className="mt-6"
              onClick={() => navigate('/settings/admin')}
            >
              Back to results
            </PopButton>
          </div>
        </div>
      </Screen>
    )
  }

  return (
    <>
    <Screen
      title="Enter Result"
      onBack={() => navigate('/settings/admin')}
      footer={
        <PopButton
          variant="grass"
          full
          disabled={incomplete || needsPenalty}
          onClick={() => setConfirming(true)}
        >
          {incomplete
            ? 'Finish each goal first'
            : needsPenalty
              ? 'Pick the shootout winner'
              : 'Submit result'}
        </PopButton>
      }
    >
      <div className="space-y-5 p-4">
        {/* Scoreline */}
        <div className="rounded-3xl border-[3px] border-ink bg-white p-4 text-center shadow-pop-lg">
          <div className="flex items-center justify-center gap-3">
            <span className="text-2xl">{match.home.flag}</span>
            <span className="font-display text-3xl">
              {homeCount} – {awayCount}
            </span>
            <span className="text-2xl">{match.away.flag}</span>
          </div>
          <p className="text-xs font-extrabold uppercase tracking-wider text-ink/40">
            {match.home.code} v {match.away.code}
          </p>
        </div>

        {/* Goals */}
        <section>
          <h2 className="px-1 pb-2 font-display text-lg">Goals</h2>
          <div className="space-y-2">
            {goals.length === 0 && (
              <p className="rounded-2xl border-2 border-dashed border-ink/15 px-4 py-4 text-center text-sm font-bold text-ink/40">
                No goals yet — a goalless draw. Add goals below if any were scored.
              </p>
            )}
            {goals.map((g, i) => (
              <GoalEditor
                key={i}
                row={g}
                team={teamOf(g.side)}
                squad={squadOf(g.side)}
                knockout={match.knockout}
                onChange={(patch) => update(i, patch)}
                onRemove={() => remove(i)}
                onToggleSide={() =>
                  update(i, { side: g.side === 'home' ? 'away' : 'home', no: '', assistNo: '' })
                }
              />
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <PopButton variant="sky" className="flex-1 text-sm" onClick={() => addGoal('home')}>
              {match.home.flag} Add {match.home.code} goal
            </PopButton>
            <PopButton variant="sky" className="flex-1 text-sm" onClick={() => addGoal('away')}>
              {match.away.flag} Add {match.away.code} goal
            </PopButton>
          </div>
        </section>

        {/* Stats */}
        <section>
          <h2 className="px-1 pb-1 font-display text-lg">Match stats</h2>
          <p className="px-1 pb-2 text-xs font-bold text-ink/45">
            Used to score goalless-draw predictions. Optional otherwise.
          </p>
          <div className="grid grid-cols-3 gap-2">
            <NumField
              label={`${match.home.code} poss %`}
              value={possessionHome}
              onChange={setPossessionHome}
              max={100}
            />
            <NumField label={`${match.home.code} shots`} value={shotsHome} onChange={setShotsHome} />
            <NumField label={`${match.away.code} shots`} value={shotsAway} onChange={setShotsAway} />
          </div>
        </section>

        {/* Penalty shootout — only when a knockout finished level */}
        {knockoutDraw && (
          <section>
            <h2 className="px-1 pb-1 font-display text-lg">Penalty shootout 🥅</h2>
            <p className="px-1 pb-2 text-xs font-bold text-ink/45">
              {match.home.code} {homeCount}–{awayCount} {match.away.code} is level —
              this knockout went to penalties. Record who advanced.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(['home', 'away'] as const).map((side) => {
                const team = teamOf(side)
                const selected = penaltyWinner === side
                return (
                  <button
                    key={side}
                    onClick={() => setPenaltyWinner(side)}
                    className={`flex items-center justify-center gap-2 rounded-2xl border-2 px-3 py-3 font-extrabold ${
                      selected
                        ? 'border-ink bg-grass text-white shadow-pop'
                        : 'border-ink/15 bg-white text-ink/70'
                    }`}
                  >
                    <span className="text-xl">{team.flag}</span>
                    {team.code} won
                  </button>
                )
              })}
            </div>
          </section>
        )}
      </div>
    </Screen>

      {/* Confirm */}
      <AnimatePresence>
        {confirming && (
          <motion.div
            className="absolute inset-0 z-50 grid place-items-center p-5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              className="absolute inset-0 bg-ink/55"
              onClick={() => !save.isPending && setConfirming(false)}
            />
            <motion.div
              initial={{ scale: 0.9, y: 16, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              className="relative w-full max-w-sm rounded-[2rem] border-[3px] border-ink bg-cream p-5 text-center shadow-pop-xl"
            >
              <div className="text-5xl">📣</div>
              <h2 className="mt-2 font-display text-2xl">Are you sure?</h2>
              <p className="mt-1 text-sm font-bold text-ink/60">
                Recording{' '}
                <span className="text-ink">
                  {match.home.code} {homeCount}–{awayCount} {match.away.code}
                </span>{' '}
                will score every prediction for this match and email all the
                players their results. This can’t be undone easily.
              </p>
              {save.isError && (
                <p className="mt-3 rounded-xl border-2 border-coral bg-coral/10 px-3 py-2 text-xs font-bold text-coral">
                  {(save.error as Error).message}
                </p>
              )}
              <div className="mt-5 space-y-2">
                <PopButton
                  variant="grass"
                  full
                  disabled={save.isPending}
                  onClick={() => save.mutate()}
                >
                  {save.isPending ? 'Saving…' : 'Yes, record & notify'}
                </PopButton>
                <button
                  onClick={() => setConfirming(false)}
                  disabled={save.isPending}
                  className="w-full py-1 text-sm font-bold text-ink/50 underline-offset-2 hover:underline disabled:opacity-40"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

function GoalEditor({
  row,
  team,
  squad,
  knockout,
  onChange,
  onRemove,
  onToggleSide,
}: {
  row: GoalRow
  team: Team
  squad: Player[]
  /** Knockout fixture — show the extra-time half selector. */
  knockout: boolean
  onChange: (patch: Partial<GoalRow>) => void
  onRemove: () => void
  onToggleSide: () => void
}) {
  return (
    <div className="rounded-2xl border-2 border-ink/15 bg-white p-3">
      <div className="flex items-center justify-between">
        <button
          onClick={onToggleSide}
          className="flex items-center gap-1.5 rounded-full border-2 border-ink bg-cream px-2.5 py-0.5 text-sm font-extrabold shadow-pop active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
        >
          <span>{team.flag}</span> {team.code} <span className="text-ink/40">⇄</span>
        </button>
        <button
          onClick={onRemove}
          aria-label="Remove goal"
          className="grid size-7 place-items-center rounded-full border-2 border-ink/15 text-ink/40 active:bg-coral/10"
        >
          ✕
        </button>
      </div>
      <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
        <PlayerSelect
          label="Scorer"
          squad={squad}
          value={row.ownGoal ? OG_OPTION : row.no}
          onChange={(v) =>
            v === OG_OPTION
              ? onChange({ ownGoal: true, no: '', assistNo: '' })
              : onChange({ ownGoal: false, no: v })
          }
          topOption={{ value: OG_OPTION, label: '🙃 Own goal' }}
        />
        <label className="block">
          <span className="block pb-1 text-[10px] font-extrabold uppercase tracking-wide text-ink/45">
            Min
          </span>
          <input
            inputMode="numeric"
            value={row.min}
            onChange={(e) => onChange({ min: e.target.value.replace(/\D/g, '').slice(0, 3) })}
            placeholder="—"
            className="w-16 rounded-xl border-2 border-ink/20 bg-cream px-2 py-2 text-center font-bold focus:border-ink focus:outline-none"
          />
        </label>
      </div>
      {!row.ownGoal && (
        <div className="mt-2">
          <PlayerSelect
            label="Assist (optional)"
            squad={squad}
            value={row.assistNo}
            onChange={(assistNo) => onChange({ assistNo })}
            allowNone
          />
        </div>
      )}
      {knockout && (
        <label className="mt-2 block">
          <span className="block pb-1 text-[10px] font-extrabold uppercase tracking-wide text-ink/45">
            Period
          </span>
          <select
            value={row.et}
            onChange={(e) => onChange({ et: e.target.value as GoalRow['et'] })}
            className="w-full rounded-xl border-2 border-ink/20 bg-cream px-2 py-2 font-bold focus:border-ink focus:outline-none"
          >
            <option value="">Normal time (0–90'+)</option>
            <option value="1">Extra time 1st half (90–105')</option>
            <option value="2">Extra time 2nd half (105–120')</option>
          </select>
        </label>
      )}
    </div>
  )
}

function PlayerSelect({
  label,
  squad,
  value,
  onChange,
  allowNone,
  topOption,
}: {
  label: string
  squad: Player[]
  value: string
  onChange: (v: string) => void
  allowNone?: boolean
  /** Extra non-player option (e.g. "Own goal") shown above the squad. */
  topOption?: { value: string; label: string }
}) {
  return (
    <label className="block">
      <span className="block pb-1 text-[10px] font-extrabold uppercase tracking-wide text-ink/45">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border-2 border-ink/20 bg-cream px-2 py-2 font-bold focus:border-ink focus:outline-none"
      >
        <option value="">{allowNone ? '— none —' : 'Pick player…'}</option>
        {topOption && <option value={topOption.value}>{topOption.label}</option>}
        {squad.map((p) => (
          <option key={p.id} value={p.number}>
            #{p.number} {p.name}
          </option>
        ))}
      </select>
    </label>
  )
}

function NumField({
  label,
  value,
  onChange,
  max,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  max?: number
}) {
  return (
    <label className="block rounded-2xl border-2 border-ink/15 bg-white p-2 text-center">
      <input
        inputMode="numeric"
        value={value}
        onChange={(e) => {
          let v = e.target.value.replace(/\D/g, '').slice(0, 3)
          if (max != null && v !== '' && Number(v) > max) v = String(max)
          onChange(v)
        }}
        placeholder="—"
        className="w-full bg-transparent text-center font-display text-2xl focus:outline-none"
      />
      <span className="mt-1 block text-[10px] font-extrabold uppercase tracking-wide text-ink/45">
        {label}
      </span>
    </label>
  )
}
