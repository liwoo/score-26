import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { PopButton } from './PopButton'

/**
 * Explains the timeline phase (drag goals → pick scorer/assister) and offers a
 * shortcut to submit the scoreline only. Skipping warns how many bonus points
 * are left on the table.
 */
export function TimelineGuideModal({
  open,
  forfeitPoints,
  onContinue,
  onSkip,
}: {
  open: boolean
  /** Max bonus points forfeited by submitting without goal details. */
  forfeitPoints: number
  onContinue: () => void
  /** Confirmed skip — proceed to submit with scoreline only. */
  onSkip: () => void
}) {
  const [phase, setPhase] = useState<'guide' | 'confirm'>('guide')

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="absolute inset-0 z-40 grid place-items-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-ink/55" />

          <motion.div
            initial={{ scale: 0.85, y: 24, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, y: 10, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            className="relative flex max-h-full w-full max-w-sm flex-col overflow-hidden rounded-[2rem] border-[3px] border-ink bg-cream shadow-pop-xl"
          >
            {phase === 'guide' ? (
              <>
                <div className="relative overflow-hidden bg-grass px-5 pb-5 pt-6 text-white">
                  <h2 className="font-display text-2xl leading-none text-sun text-stroke-ink drop-shadow-[2px_2px_0_var(--color-ink)]">
                    Place your goals
                  </h2>
                  <p className="mt-2 font-display text-base leading-tight text-white/95">
                    Two quick steps for bonus points — or skip straight to submit.
                  </p>
                </div>

                <div className="space-y-3 p-4">
                  <Step
                    n={1}
                    emoji="⏱️"
                    title="Drag each ball to a time slot"
                    body="Drop every goal into the minute window you think it’ll be scored in (e.g. 20–30')."
                  />
                  <Step
                    n={2}
                    emoji="👟"
                    title="Pick the scorer & assister"
                    body="Tap each placed ball to choose who scores it — and who set it up."
                  />
                  <p className="text-center text-xs font-bold text-ink/45">
                    Every correct call adds bonus points on top of your scoreline.
                  </p>
                </div>

                <div className="space-y-2 border-t-2 border-ink/10 bg-cream/95 p-4">
                  <PopButton variant="coral" full className="text-lg" onClick={onContinue}>
                    Let’s place them ⚽
                  </PopButton>
                  <button
                    onClick={() => setPhase('confirm')}
                    className="w-full py-1 text-sm font-bold text-ink/50 underline-offset-2 hover:underline"
                  >
                    No thanks, just submit my scores
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="relative overflow-hidden bg-coral px-5 pb-5 pt-6 text-white">
                  <h2 className="font-display text-2xl leading-none text-white text-stroke-ink drop-shadow-[2px_2px_0_var(--color-ink)]">
                    Sure about that?
                  </h2>
                  <p className="mt-2 font-display text-base leading-tight text-white/95">
                    You’re leaving points on the table.
                  </p>
                </div>

                <div className="p-4 text-center">
                  <div className="mx-auto inline-flex flex-col items-center rounded-3xl border-[3px] border-ink bg-white px-6 py-4 shadow-pop-lg">
                    <span className="font-display text-5xl text-coral">
                      +{forfeitPoints}
                    </span>
                    <span className="text-xs font-extrabold uppercase tracking-wider text-ink/50">
                      bonus points skipped
                    </span>
                  </div>
                  <p className="mt-3 text-sm font-bold text-ink/60">
                    Adding goal times, scorers and assists could earn up to{' '}
                    <span className="text-ink">{forfeitPoints}</span> more — including
                    a shot at the perfect-prediction bonus. You can still refine this
                    later (up to 3 tries).
                  </p>
                </div>

                <div className="space-y-2 border-t-2 border-ink/10 bg-cream/95 p-4">
                  <PopButton
                    variant="grass"
                    full
                    className="text-lg"
                    onClick={() => setPhase('guide')}
                  >
                    ⚡ Add the details
                  </PopButton>
                  <button
                    onClick={onSkip}
                    className="w-full py-1 text-sm font-bold text-ink/50 underline-offset-2 hover:underline"
                  >
                    Submit scores only
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function Step({
  n,
  emoji,
  title,
  body,
}: {
  n: number
  emoji: string
  title: string
  body: string
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border-2 border-ink/10 bg-white p-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl border-2 border-ink bg-sun font-display text-lg">
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-display text-base leading-tight">
          {emoji} {title}
        </p>
        <p className="mt-0.5 text-xs font-bold text-ink/55">{body}</p>
      </div>
    </div>
  )
}
