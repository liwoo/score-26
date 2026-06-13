import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { Screen } from '../../components/Screen'
import { FlagBadge } from '../../components/FlagBadge'
import { StepDots } from '../../features/prediction/PredictionLayout'
import {
  usePrediction,
  type Outcome,
} from '../../features/prediction/PredictionContext'

export function WinnerStep() {
  const navigate = useNavigate()
  const { match, setOutcome } = usePrediction()

  const choose = (o: Outcome) => {
    setOutcome(o)
    if (o === 'goalless-draw') navigate('stats')
    else navigate('margin')
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
    <Screen title="Your Call" onBack={() => navigate('/matches')}>
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
  )
}
