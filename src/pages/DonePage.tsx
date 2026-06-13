import { useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { Avatar } from '../components/Avatar'
import { Flag } from '../components/Flag'
import { PopButton } from '../components/PopButton'
import { MAX_PREDICTIONS } from '../data/profile'

type DoneState = {
  username?: string
  seed?: string
  country?: { iso: string; name: string }
  predictionNo?: number
}

const CONFETTI = ['⚽', '🏆', '🎉', '🥅', '⭐', '🔥', '🎯', '🟡', '🟢']

export function DonePage() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const s = (state ?? {}) as DoneState
  const name = s.username || 'Champion'

  return (
    <div className="relative flex h-full flex-col items-center justify-center overflow-hidden px-6 text-center">
      {/* confetti rain */}
      {CONFETTI.flatMap((c, row) =>
        Array.from({ length: 3 }, (_, k) => {
          const i = row * 3 + k
          const left = (i * 37) % 100
          return (
            <motion.span
              key={`${c}-${i}`}
              className="pointer-events-none absolute text-2xl"
              style={{ left: `${left}%`, top: -30 }}
              initial={{ y: -40, rotate: 0, opacity: 0 }}
              animate={{ y: 760, rotate: 360, opacity: [0, 1, 1, 0] }}
              transition={{
                duration: 2.6 + (i % 5) * 0.4,
                repeat: Infinity,
                delay: (i % 7) * 0.25,
                ease: 'easeIn',
              }}
            >
              {c}
            </motion.span>
          )
        }),
      )}

      <motion.div
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 220, damping: 12 }}
        className="relative"
      >
        <Avatar seed={s.seed || 'Champion'} size={110} className="shadow-pop-lg" />
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="relative mt-5 font-display text-4xl text-grass text-stroke-ink drop-shadow-[2px_2px_0_var(--color-ink)]"
      >
        You're in!
      </motion.h1>
      <p className="relative mt-2 flex items-center justify-center gap-2 font-display text-xl">
        {name}
        {s.country && <Flag iso={s.country.iso} size={22} shadow={false} />}
      </p>
      <p className="relative mt-1 max-w-xs text-sm font-bold text-ink/60">
        Prediction locked. Points land as the goals fly in. Come back at
        full-time to see how you did. ⚽
      </p>

      {s.predictionNo != null && (
        <span className="relative mt-3 rounded-full border-2 border-ink bg-sun px-3 py-1 font-display text-sm shadow-pop">
          {s.predictionNo >= MAX_PREDICTIONS
            ? `Prediction ${s.predictionNo}/${MAX_PREDICTIONS} — that's your last for this match. We keep your best.`
            : `Prediction ${s.predictionNo}/${MAX_PREDICTIONS} saved — you can refine it ${MAX_PREDICTIONS - s.predictionNo}× more.`}
        </span>
      )}

      <div className="relative mt-8 flex w-full max-w-xs flex-col gap-3">
        <PopButton variant="sun" full onClick={() => navigate('/matches')}>
          🎯 Predict Another
        </PopButton>
        <PopButton variant="ghost" full onClick={() => navigate('/')}>
          🏆 View Leaderboard
        </PopButton>
      </div>
    </div>
  )
}
