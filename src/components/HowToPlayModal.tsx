import { AnimatePresence, motion } from 'motion/react'
import { PopButton } from './PopButton'

type Layer = { emoji: string; title: string; hint: string }

// Framed as "each layer you add earns more" — depth is optional, never required.
const LAYERS: Layer[] = [
  { emoji: '🏆', title: 'Who wins', hint: 'Pick the winner or a draw' },
  { emoji: '🔢', title: 'The scoreline', hint: 'Call the exact score for more' },
  { emoji: '⏱️', title: 'When goals go in', hint: 'Bonus for each goal’s timing' },
  { emoji: '👟', title: 'Scorers & assists', hint: 'Bonus for every name you nail' },
  { emoji: '📊', title: 'Possession & shots', hint: 'Extra points on the tight ones' },
  { emoji: '🥅', title: 'Penalty shootouts', hint: 'Knockout draw? Call who wins it for +5' },
]

export function HowToPlayModal({
  open,
  onContinue,
  onClose,
}: {
  open: boolean
  onContinue: () => void
  onClose: () => void
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="absolute inset-0 z-40 grid place-items-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            aria-label="Close"
            onClick={onClose}
            className="absolute inset-0 bg-ink/55"
          />

          <motion.div
            initial={{ scale: 0.85, y: 24, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, y: 10, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            className="relative flex max-h-full w-full max-w-sm flex-col overflow-hidden rounded-[2rem] border-[3px] border-ink bg-cream shadow-pop-xl"
          >
            {/* header */}
            <div className="relative overflow-hidden bg-grass px-5 pb-5 pt-6 text-white">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-20"
                style={{
                  backgroundImage: 'radial-gradient(#fff 1.5px, transparent 1.6px)',
                  backgroundSize: '16px 16px',
                }}
              />
              <h2 className="relative font-display text-3xl leading-none text-sun text-stroke-ink drop-shadow-[2px_2px_0_var(--color-ink)]">
                How it works
              </h2>
              <p className="relative mt-2 font-display text-lg leading-tight text-white/95">
                Call the match your way — the more you predict, the bigger your
                score. No wrong moves. ⚽
              </p>
              <span className="relative mt-3 inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-white px-3 py-1 font-display text-sm text-ink shadow-pop">
                ⏱️ About 3 minutes
              </span>
            </div>

            {/* layers */}
            <div className="no-scrollbar flex-1 overflow-y-auto p-4">
              <p className="mb-3 text-center text-sm font-bold text-ink/60">
                Every layer you add stacks up to a more complete prediction:
              </p>
              <ul className="space-y-2">
                {LAYERS.map((l, i) => (
                  <motion.li
                    key={l.title}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 + i * 0.06 }}
                    className="flex items-center gap-3 rounded-2xl border-2 border-ink/10 bg-white px-3 py-2"
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl border-2 border-ink bg-cream text-lg">
                      {l.emoji}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-base leading-tight">{l.title}</p>
                      <p className="text-xs font-bold text-ink/50">{l.hint}</p>
                    </div>
                    <span className="font-display text-lg text-grass">＋</span>
                  </motion.li>
                ))}
              </ul>

              <p className="mt-3 text-center text-xs font-bold text-ink/50">
                🎯 Up to 3 tries per match — we keep your best one.
              </p>
            </div>

            {/* action */}
            <div className="border-t-2 border-ink/10 bg-cream/95 p-4">
              <PopButton variant="coral" full className="text-xl" onClick={onContinue}>
                Let’s go ⚡
              </PopButton>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
