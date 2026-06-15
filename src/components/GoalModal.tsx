import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { PlayerAvatar } from './PlayerAvatar'
import type { Team } from '../data/types'
import { useSquad } from '../data/useSquad'
import { NO_ASSIST } from '../features/prediction/PredictionContext'

const POS_COLOR: Record<string, string> = {
  GK: 'bg-sun',
  DEF: 'bg-sky',
  MID: 'bg-grass text-white',
  FWD: 'bg-coral text-white',
}

type Step = 'scorer' | 'assist'

/**
 * Per-goal picker: first who scores, then who assists. On the assist step the
 * predicted scorer is blocked out (you can't assist your own goal) and a
 * "No assist" option is offered for solo goals.
 */
export function GoalModal({
  open,
  team,
  minuteLabel,
  scorerId,
  assistId,
  onPickScorer,
  onPickAssist,
  onClose,
}: {
  open: boolean
  team: Team | null
  minuteLabel: string | null
  scorerId: string | null
  assistId: string | null
  onPickScorer: (playerId: string) => void
  onPickAssist: (playerId: string) => void
  onClose: () => void
}) {
  const [step, setStep] = useState<Step>('scorer')
  const { data: squad = [], isLoading, error } = useSquad(team?.code)

  // Reset to the scorer step each time the modal opens (render-time reset, no effect).
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setStep('scorer')
  }

  const scorer = squad.find((p) => p.id === scorerId) ?? null

  return (
    <AnimatePresence>
      {open && team && (
        <motion.div
          className="absolute inset-0 z-30 flex flex-col justify-end"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            aria-label="Close"
            onClick={onClose}
            className="absolute inset-0 bg-ink/50"
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className="relative max-h-[80%] overflow-hidden rounded-t-[2rem] border-t-[3px] border-ink bg-cream"
          >
            {/* header */}
            <div className="flex items-center gap-3 border-b-2 border-ink/10 px-4 py-3">
              <span className="text-2xl">{team.flag}</span>
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-xl leading-tight">
                  {step === 'scorer' ? 'Who scores it?' : 'Who assists it?'}
                </h2>
                <p className="truncate text-xs font-bold text-ink/50">
                  {team.name}
                  {minuteLabel ? ` · ${minuteLabel}` : ''}
                </p>
              </div>
              <button
                onClick={onClose}
                className="grid size-9 place-items-center rounded-full border-2 border-ink bg-white shadow-pop"
              >
                ✕
              </button>
            </div>

            {/* step switcher */}
            <div className="flex gap-2 px-4 py-2">
              <StepChip
                active={step === 'scorer'}
                label="⚽ Goal"
                value={scorer?.name}
                onClick={() => setStep('scorer')}
              />
              <StepChip
                active={step === 'assist'}
                label="🅰️ Assist"
                value={
                  assistId === NO_ASSIST
                    ? 'No assist'
                    : (squad.find((p) => p.id === assistId)?.name ?? null)
                }
                disabled={!scorerId}
                onClick={() => scorerId && setStep('assist')}
              />
            </div>

            <ul className="no-scrollbar max-h-[54vh] divide-y-2 divide-ink/5 overflow-y-auto pb-2">
              {/* No-assist option, only on the assist step */}
              {step === 'assist' && (
                <li>
                  <button
                    onClick={() => onPickAssist(NO_ASSIST)}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                      assistId === NO_ASSIST ? 'bg-grass/20' : 'active:bg-ink/5'
                    }`}
                  >
                    <span className="grid size-[42px] place-items-center rounded-full border-2 border-ink bg-white text-xl">
                      🚫
                    </span>
                    <div className="flex-1">
                      <p className="font-display text-base leading-tight">
                        No assist
                      </p>
                      <p className="text-xs font-bold text-ink/50">
                        Solo goal — nobody set it up
                      </p>
                    </div>
                    {assistId === NO_ASSIST && <span className="text-xl">✅</span>}
                  </button>
                </li>
              )}

              {isLoading && (
                <li className="px-4 py-8 text-center text-sm font-bold text-ink/40">
                  Loading squad…
                </li>
              )}

              {!isLoading && error && (
                <li className="px-4 py-6 text-center text-sm font-bold text-coral">
                  Could not load squad right now. Check Supabase connection and try
                  again.
                </li>
              )}

              {!isLoading && !error && squad.length === 0 && (
                <li className="space-y-1 px-4 py-6 text-center">
                  <p className="text-sm font-extrabold text-ink">
                    No squad found for {team.name}.
                  </p>
                  <p className="text-xs font-bold text-ink/55">
                    Import players into Supabase first (Wikipedia squads →
                    players table).
                  </p>
                </li>
              )}

              {squad.map((p) => {
                const isScorer = p.id === scorerId
                const blocked = step === 'assist' && isScorer
                const selected =
                  step === 'scorer' ? p.id === scorerId : p.id === assistId
                return (
                  <li key={p.id}>
                    <button
                      disabled={blocked}
                      onClick={() => {
                        if (step === 'scorer') {
                          onPickScorer(p.id)
                          setStep('assist')
                        } else {
                          onPickAssist(p.id)
                        }
                      }}
                      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                        blocked
                          ? 'cursor-not-allowed opacity-45'
                          : selected
                            ? 'bg-grass/20'
                            : 'active:bg-ink/5'
                      }`}
                    >
                      <span className="w-6 text-center font-display text-ink/40">
                        {p.number}
                      </span>
                      <PlayerAvatar name={p.name} photo={p.photo} size={42} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-display text-base leading-tight">
                          {p.name}
                        </p>
                        <span
                          className={`mt-0.5 inline-block rounded-full border-2 border-ink px-2 py-px text-[10px] font-extrabold ${POS_COLOR[p.position]}`}
                        >
                          {p.position}
                        </span>
                      </div>
                      {blocked ? (
                        <span className="rounded-full border-2 border-ink bg-ink px-2 py-0.5 text-[10px] font-extrabold text-cream">
                          SCORER
                        </span>
                      ) : (
                        <span className="flex flex-col items-center">
                          <span className="rounded-full border-2 border-ink bg-sun px-2.5 py-0.5 font-display text-sm shadow-pop">
                            {p.points}
                          </span>
                          <span className="mt-0.5 text-[9px] font-bold text-ink/40">
                            PTS
                          </span>
                        </span>
                      )}
                      {selected && !blocked && <span className="text-xl">✅</span>}
                    </button>
                  </li>
                )
              })}
            </ul>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function StepChip({
  active,
  label,
  value,
  disabled,
  onClick,
}: {
  active: boolean
  label: string
  value?: string | null
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`flex flex-1 flex-col items-start rounded-2xl border-2 border-ink px-3 py-1.5 text-left transition-colors ${
        active ? 'bg-ink text-cream' : disabled ? 'bg-ink/5 opacity-50' : 'bg-white'
      }`}
    >
      <span className="font-display text-sm leading-tight">{label}</span>
      <span
        className={`truncate text-xs font-bold ${active ? 'text-cream/70' : 'text-ink/50'}`}
      >
        {value ?? 'tap to pick'}
      </span>
    </button>
  )
}
