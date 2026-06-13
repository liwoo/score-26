import { useRef } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { Screen } from '../../components/Screen'
import { FlagBadge } from '../../components/FlagBadge'
import type { Team } from '../../data/types'
import { usePrediction } from '../../features/prediction/PredictionContext'

const POSSESSION_OPTS = [35, 40, 45, 50, 55, 60, 65]

/** Draggable possession split — drag anywhere on the bar to set home's share. */
function PossessionBar({
  home,
  homeColor,
  awayColor,
  onChange,
}: {
  home: number
  homeColor: string
  awayColor: string
  onChange: (pct: number) => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  const update = (clientX: number) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const pct = ((clientX - rect.left) / rect.width) * 100
    onChange(Math.round(Math.max(5, Math.min(95, pct))))
  }

  return (
    <div
      ref={ref}
      role="slider"
      aria-label="Home possession"
      aria-valuenow={home}
      aria-valuemin={5}
      aria-valuemax={95}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        update(e.clientX)
      }}
      onPointerMove={(e) => {
        if (e.buttons === 1) update(e.clientX)
      }}
      className="relative h-9 cursor-ew-resize touch-none select-none overflow-hidden rounded-full border-2 border-ink"
    >
      <motion.div
        className="absolute inset-y-0 left-0"
        style={{ backgroundColor: homeColor }}
        animate={{ width: `${home}%` }}
        transition={{ type: 'spring', stiffness: 400, damping: 34 }}
      />
      <div
        className="absolute inset-y-0 right-0"
        style={{ left: `${home}%`, backgroundColor: awayColor }}
      />
      {/* drag handle */}
      <motion.div
        className="absolute top-1/2 grid h-11 w-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-ink bg-white shadow-pop"
        animate={{ left: `${home}%` }}
        transition={{ type: 'spring', stiffness: 400, damping: 34 }}
      >
        <span className="text-ink/40">⋮⋮</span>
      </motion.div>
    </div>
  )
}

function Stepper({
  value,
  min,
  max,
  onChange,
  tint,
}: {
  value: number
  min: number
  max: number
  onChange: (n: number) => void
  tint?: string
}) {
  const btn =
    'grid size-11 place-items-center rounded-2xl border-2 border-ink bg-white font-display text-2xl shadow-pop active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-30 disabled:active:translate-x-0 disabled:active:translate-y-0'
  return (
    <div className="flex items-center gap-3">
      <button
        className={btn}
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        −
      </button>
      <span
        className="grid h-12 w-14 place-items-center rounded-2xl border-2 border-ink font-display text-3xl"
        style={{
          backgroundColor: tint
            ? `color-mix(in srgb, ${tint} 16%, white)`
            : undefined,
        }}
      >
        {value}
      </span>
      <button
        className={btn}
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        +
      </button>
    </div>
  )
}

function ShotRow({
  team,
  value,
  onChange,
}: {
  team: Team
  value: number
  onChange: (n: number) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <FlagBadge iso={team.iso} size={38} ring={team.color} />
        <span className="font-display text-lg">{team.code}</span>
      </div>
      <Stepper value={value} min={0} max={40} onChange={onChange} tint={team.color} />
    </div>
  )
}

export function StatsStep() {
  const navigate = useNavigate()
  const { state, match, setPossession, setShotsHome, setShotsAway } =
    usePrediction()

  if (state.outcome !== 'goalless-draw') return <Navigate to=".." replace />

  const home = state.possessionHome
  const away = 100 - home

  return (
    <Screen
      title="Read the Game"
      onBack={() => navigate(-1)}
      footer={
        <button
          onClick={() => navigate('../submit')}
          className="w-full rounded-2xl border-2 border-ink bg-grass px-6 py-3 font-display text-xl uppercase tracking-wide text-white shadow-pop active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
        >
          ✅ Review &amp; Submit
        </button>
      }
    >
      <div className="space-y-5 p-4">
        <p className="text-center font-display text-xl leading-tight">
          0–0 it is. 🧤
          <br />
          <span className="text-sm font-bold text-ink/50">
            No goals to place — call the game stats instead.
          </span>
        </p>

        {/* Possession */}
        <section className="rounded-3xl border-[3px] border-ink bg-white p-4 shadow-pop-lg">
          <h2 className="mb-3 text-center font-display text-lg">Possession</h2>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex flex-col items-center gap-1">
              <FlagBadge iso={match.home.iso} size={44} ring={match.home.color} />
              <span className="font-display text-2xl">{home}%</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <FlagBadge iso={match.away.iso} size={44} ring={match.away.color} />
              <span className="font-display text-2xl">{away}%</span>
            </div>
          </div>

          <PossessionBar
            home={home}
            homeColor={match.home.color}
            awayColor={match.away.color}
            onChange={setPossession}
          />

          <div className="no-scrollbar mt-3 flex justify-center gap-2 overflow-x-auto">
            {POSSESSION_OPTS.map((p) => (
              <button
                key={p}
                onClick={() => setPossession(p)}
                className={`shrink-0 rounded-full border-2 border-ink px-3 py-1 text-sm font-extrabold transition-colors ${
                  home === p ? 'bg-ink text-cream' : 'bg-white text-ink/70'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <p className="mt-2 text-center text-xs font-bold text-ink/40">
            Drag the bar or tap a pill.
          </p>
        </section>

        {/* Total shots per team */}
        <section className="space-y-3 rounded-3xl border-[3px] border-ink bg-white p-4 shadow-pop-lg">
          <h2 className="text-center font-display text-lg">Total shots</h2>
          <ShotRow team={match.home} value={state.shotsHome} onChange={setShotsHome} />
          <div className="border-t-2 border-ink/5" />
          <ShotRow team={match.away} value={state.shotsAway} onChange={setShotsAway} />
        </section>
      </div>
    </Screen>
  )
}
