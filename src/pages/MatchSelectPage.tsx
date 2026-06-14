import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { Screen } from '../components/Screen'
import { FlagBadge } from '../components/FlagBadge'
import { getMatchDays, minutesUntilLock, todayKey } from '../data/matches'
import type { Match } from '../data/types'

function kickoffLabel(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function LockPill({ match }: { match: Match }) {
  if (match.status === 'open') {
    const mins = minutesUntilLock(match)
    const label =
      mins >= 120 ? `Locks in ${Math.round(mins / 60)}h` : `Locks in ${mins}m`
    return (
      <span className="rounded-full border-2 border-ink bg-grass px-2.5 py-0.5 text-xs font-extrabold text-white">
        🔓 {label}
      </span>
    )
  }
  if (match.status === 'locked')
    return (
      <span className="rounded-full border-2 border-ink bg-ink px-2.5 py-0.5 text-xs font-extrabold text-cream">
        🔒 Locked
      </span>
    )
  if (match.status === 'live')
    return (
      <span className="rounded-full border-2 border-ink bg-coral px-2.5 py-0.5 text-xs font-extrabold text-white">
        🔴 Live
      </span>
    )
  return (
    <span className="rounded-full border-2 border-ink bg-ink/60 px-2.5 py-0.5 text-xs font-extrabold text-cream">
      Full-time
    </span>
  )
}

function MatchCard({ match, i }: { match: Match; i: number }) {
  const navigate = useNavigate()
  const open = match.status === 'open'
  return (
    <motion.button
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.06 }}
      whileTap={open ? { x: 3, y: 3 } : undefined}
      disabled={!open}
      onClick={() => open && navigate(`/play/${match.id}`)}
      className={`w-full rounded-3xl border-[3px] border-ink bg-white p-4 text-left shadow-pop-lg ${
        open ? 'cursor-pointer' : 'cursor-not-allowed opacity-60 grayscale'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="font-display text-sm text-ink/50">{match.group}</span>
        <LockPill match={match} />
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex flex-1 flex-col items-center gap-1">
          <FlagBadge iso={match.home.iso} size={56} ring={match.home.color} />
          <span className="font-display text-base">{match.home.code}</span>
        </div>
        <div className="flex flex-col items-center px-1">
          <span className="font-display text-2xl text-ink/30">VS</span>
          <span className="mt-1 text-center text-[11px] font-bold leading-tight text-ink/60">
            {kickoffLabel(match.kickoff)}
          </span>
        </div>
        <div className="flex flex-1 flex-col items-center gap-1">
          <FlagBadge iso={match.away.iso} size={56} ring={match.away.color} />
          <span className="font-display text-base">{match.away.code}</span>
        </div>
      </div>

      <p className="mt-3 truncate text-center text-xs font-bold text-ink/50">
        📍 {match.venue}
      </p>
    </motion.button>
  )
}

function DayTab({
  date,
  enabled,
  selected,
  glyph,
  onClick,
  innerRef,
}: {
  date: Date
  enabled: boolean
  selected: boolean
  glyph: string
  onClick?: () => void
  innerRef?: (el: HTMLButtonElement | null) => void
}) {
  const weekday = date.toLocaleDateString(undefined, { weekday: 'short' })
  const day = date.getDate()
  return (
    <button
      ref={innerRef}
      disabled={!enabled}
      onClick={onClick}
      className={`flex w-14 shrink-0 flex-col items-center rounded-2xl border-2 border-ink py-1.5 transition-colors ${
        selected
          ? 'bg-coral text-white shadow-pop'
          : enabled
            ? 'bg-white text-ink'
            : 'bg-white text-ink/30 opacity-60'
      }`}
    >
      <span className="text-[10px] font-extrabold uppercase tracking-wide">
        {weekday}
      </span>
      <span className="font-display text-xl leading-none">{day}</span>
      <span className="mt-0.5 text-[9px] font-bold">{glyph}</span>
    </button>
  )
}

export function MatchSelectPage() {
  const navigate = useNavigate()
  const days = getMatchDays()
  const today = todayKey()

  // Both today's slate and the next fixture day ("tomorrow") are predictable —
  // you can get ahead and lock in tomorrow's games from today. Anything further
  // out stays locked.
  const tomorrowKey = days.find((d) => d.key > today)?.key
  const selectableKeys = new Set(
    [today, tomorrowKey].filter(
      (k): k is string => !!k && days.some((d) => d.key === k),
    ),
  )
  // Default to today if it has fixtures, else the nearest upcoming day.
  const defaultKey =
    (days.some((d) => d.key === today) ? today : undefined) ??
    tomorrowKey ??
    days[days.length - 1]?.key

  const [selected, setSelected] = useState(defaultKey)
  const selectedDay = days.find((d) => d.key === selected) ?? days[0]

  // Center the active day in the strip on mount.
  const activeTabRef = useRef<HTMLButtonElement | null>(null)
  useEffect(() => {
    activeTabRef.current?.scrollIntoView({
      inline: 'center',
      block: 'nearest',
    })
  }, [])

  const dayHeading = selectedDay?.date.toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <Screen title="Pick a Match" onBack={() => navigate('/')}>
      {/* Day strip */}
      <div className="no-scrollbar flex gap-2 overflow-x-auto border-b-2 border-ink/10 px-4 py-3">
        {days.map((d) => {
          const enabled = selectableKeys.has(d.key)
          const isSelected = d.key === selected
          const glyph = isSelected
            ? '●'
            : enabled
              ? '🔓'
              : d.key < today
                ? '✓'
                : '🔒'
          return (
            <DayTab
              key={d.key}
              date={d.date}
              enabled={enabled}
              selected={isSelected}
              glyph={glyph}
              onClick={enabled ? () => setSelected(d.key) : undefined}
              innerRef={
                d.key === defaultKey ? (el) => (activeTabRef.current = el) : undefined
              }
            />
          )
        })}
      </div>

      <div className="space-y-4 p-4">
        <div className="text-center">
          <p className="font-display text-lg">{dayHeading}</p>
          <p className="text-sm font-bold text-ink/60">
            {selectedDay?.matches.length ?? 0} matches · predictions close 10 min
            before kickoff ⏱️
          </p>
        </div>

        {selectedDay?.matches.map((m, i) => (
          <MatchCard key={m.id} match={m} i={i} />
        ))}

        {(!selectedDay || selectedDay.matches.length === 0) && (
          <p className="py-10 text-center font-bold text-ink/40">
            No matches today — check back tomorrow. ⚽
          </p>
        )}
      </div>
    </Screen>
  )
}
