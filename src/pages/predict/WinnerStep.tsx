import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { Screen } from '../../components/Screen'
import { ShareButton } from '../../components/ShareButton'
import { FlagBadge } from '../../components/FlagBadge'
import { StepDots } from '../../features/prediction/PredictionLayout'
import {
  usePrediction,
  type Outcome,
  type Side,
} from '../../features/prediction/PredictionContext'

export function WinnerStep() {
  const navigate = useNavigate()
  const { match, setOutcome, setPenaltyWinner } = usePrediction()
  // A draw chosen on a knockout fixture is parked here until the player calls
  // the shootout — knockout ties go to penalties, so we force that pick.
  const [pendingDraw, setPendingDraw] = useState<Outcome | null>(null)

  const go = (o: Outcome) => {
    if (o === 'goalless-draw') navigate('stats')
    else navigate('margin')
  }

  const choose = (o: Outcome) => {
    const isDraw = o === 'score-draw' || o === 'goalless-draw'
    setOutcome(o)
    // Knockout draws can't stand — gate navigation on the penalty shootout pick.
    if (match.knockout && isDraw) {
      setPendingDraw(o)
      return
    }
    go(o)
  }

  const pickPenalty = (side: Side) => {
    setPenaltyWinner(side)
    const o = pendingDraw
    setPendingDraw(null)
    if (o) go(o)
  }

  const kickoff = new Date(match.kickoff).toLocaleString(undefined, {
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })

  const options: Array<{ o: Outcome; label: string; sub: string; cls: string }> = [
    {
      o: 'home',
      label: match.home.name,
      sub: 'wins',
      cls: 'bg-sky/40',
    },
    {
      o: 'away',
      label: match.away.name,
      sub: 'wins',
      cls: 'bg-coral/30',
    },
    {
      o: 'score-draw',
      label: 'Score Draw',
      sub: 'both teams net',
      cls: 'bg-sun/40',
    },
    {
      o: 'goalless-draw',
      label: 'Scoreless Draw',
      sub: '0 – 0 nil all',
      cls: 'bg-grass/25',
    },
  ]

  return (
    <>
    <Screen title="Your Call" onBack={() => navigate('/matches')} right={<ShareButton />}>
      <StepDots step={0} total={4} />

      {/* Fixture header */}
      <div className="px-4">
        <div className="rounded-3xl border-[3px] border-ink bg-white p-4 shadow-pop-lg">
          <p className="text-center text-xs font-extrabold uppercase tracking-wider text-ink/50">
            {match.group}
          </p>
          <div className="mt-2 flex items-center justify-center gap-4">
            <div className="flex flex-col items-center gap-1">
              <FlagBadge iso={match.home.iso} size={64} ring={match.home.color} />
              <span className="font-display">{match.home.code}</span>
            </div>
            <span className="font-display text-3xl text-ink/30">VS</span>
            <div className="flex flex-col items-center gap-1">
              <FlagBadge iso={match.away.iso} size={64} ring={match.away.color} />
              <span className="font-display">{match.away.code}</span>
            </div>
          </div>
          <div className="mt-3 space-y-1 text-center text-sm font-bold text-ink/70">
            <p>🕑 {kickoff}</p>
            <p>📍 {match.venue}</p>
          </div>
        </div>
      </div>

      {/* Outcome choices */}
      <p className="mt-5 text-center font-display text-xl">
        Who takes it? 🤔
      </p>
      {match.knockout && (
        <p className="mx-auto mt-1 max-w-xs px-6 text-center text-xs font-bold text-ink/50">
          Knockout tie — call it before penalties. A draw means you’ll pick the
          shootout winner next. 🥅
        </p>
      )}
      <div className="grid grid-cols-2 gap-3 p-4">
        {options.map((opt, i) => (
          <motion.button
            key={opt.o}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.06 }}
            whileTap={{ x: 3, y: 3 }}
            onClick={() => choose(opt.o)}
            className={`flex aspect-square flex-col items-center justify-center gap-1 rounded-3xl border-[3px] border-ink p-3 text-center shadow-pop-lg ${opt.cls}`}
          >
            {(opt.o === 'home' || opt.o === 'away') && (
              <span className="text-3xl">
                {opt.o === 'home' ? match.home.flag : match.away.flag}
              </span>
            )}
            {opt.o === 'score-draw' && <span className="text-3xl">🤝</span>}
            {opt.o === 'goalless-draw' && <span className="text-3xl">🥱</span>}
            <span className="font-display text-lg leading-tight">
              {opt.label}
            </span>
            <span className="text-xs font-bold text-ink/50">{opt.sub}</span>
          </motion.button>
        ))}
      </div>
    </Screen>

      {/* Penalty shootout — forced for a knockout draw */}
      <AnimatePresence>
        {pendingDraw && (
          <motion.div
            className="absolute inset-0 z-50 grid place-items-center p-5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              className="absolute inset-0 bg-ink/55"
              onClick={() => setPendingDraw(null)}
            />
            <motion.div
              initial={{ scale: 0.9, y: 16, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              className="relative w-full max-w-sm rounded-[2rem] border-[3px] border-ink bg-cream p-5 text-center shadow-pop-xl"
            >
              <div className="text-5xl">🥅</div>
              <h2 className="mt-2 font-display text-2xl">Off to penalties!</h2>
              <p className="mt-1 text-sm font-bold text-ink/60">
                A {pendingDraw === 'goalless-draw' ? 'scoreless' : 'score'} draw
                in a knockout goes to a shootout. Who holds their nerve? 🎯
              </p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                {(['home', 'away'] as const).map((side) => {
                  const team = side === 'home' ? match.home : match.away
                  return (
                    <button
                      key={side}
                      onClick={() => pickPenalty(side)}
                      className={`flex flex-col items-center justify-center gap-1 rounded-3xl border-[3px] border-ink p-4 shadow-pop-lg active:translate-x-[2px] active:translate-y-[2px] active:shadow-none ${
                        side === 'home' ? 'bg-sky/40' : 'bg-coral/30'
                      }`}
                    >
                      <span className="text-3xl">{team.flag}</span>
                      <span className="font-display text-lg leading-tight">
                        {team.name}
                      </span>
                      <span className="text-xs font-bold text-ink/50">
                        wins shootout
                      </span>
                    </button>
                  )
                })}
              </div>
              <button
                onClick={() => setPendingDraw(null)}
                className="mt-4 w-full py-1 text-sm font-bold text-ink/50 underline-offset-2 hover:underline"
              >
                ← Pick a different result
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
