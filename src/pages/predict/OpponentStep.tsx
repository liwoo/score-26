import { Navigate, useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { Screen } from '../../components/Screen'
import { ShareButton } from '../../components/ShareButton'
import { StepDots } from '../../features/prediction/PredictionLayout'
import { usePrediction } from '../../features/prediction/PredictionContext'

// Always show 0..9 so the disabled cells make the constraint obvious.
const RANGE = Array.from({ length: 10 }, (_, i) => i) // 0..9

export function OpponentStep() {
  const navigate = useNavigate()
  const { state, winnerTeam, loserTeam, setLoserGoals, buildGoals } =
    usePrediction()

  if (state.winnerGoals == null) return <Navigate to=".." replace />
  const max = state.winnerGoals // loser must score strictly fewer

  const choose = (n: number) => {
    setLoserGoals(n)
    buildGoals()
    navigate('../timeline')
  }

  return (
    <Screen title="…and them?" onBack={() => navigate(-1)} right={<ShareButton />}>
      <StepDots step={2} total={4} />
      <p className="px-6 text-center font-display text-2xl leading-tight">
        {winnerTeam?.name} win {state.winnerGoals}–?
        <br />
        <span className="text-lg text-ink/60">
          How many for {loserTeam?.name}?
        </span>
      </p>

      <div className="grid grid-cols-3 gap-3 p-4">
        {RANGE.map((n, i) => {
          const enabled = n < max
          return (
            <motion.button
              key={n}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.03 }}
              whileTap={enabled ? { x: 3, y: 3 } : undefined}
              disabled={!enabled}
              onClick={() => enabled && choose(n)}
              className={`grid aspect-square place-items-center rounded-3xl border-[3px] border-ink font-display text-4xl ${
                enabled
                  ? 'bg-white shadow-pop-lg active:shadow-none'
                  : 'cursor-not-allowed border-dashed border-ink/30 bg-ink/5 text-ink/20 shadow-none'
              }`}
              style={{
                backgroundColor:
                  enabled && loserTeam
                    ? `color-mix(in srgb, ${loserTeam.color} 12%, white)`
                    : undefined,
              }}
            >
              {n}
            </motion.button>
          )
        })}
      </div>
      <p className="px-6 pb-6 text-center text-sm font-bold text-ink/50">
        They can't outscore the winner — so only {max} option
        {max === 1 ? '' : 's'} unlocked. 🔒
      </p>
    </Screen>
  )
}
