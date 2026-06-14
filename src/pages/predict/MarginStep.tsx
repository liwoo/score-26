import { Navigate, useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { Screen } from '../../components/Screen'
import { ShareButton } from '../../components/ShareButton'
import { StepDots } from '../../features/prediction/PredictionLayout'
import { usePrediction } from '../../features/prediction/PredictionContext'

const RANGE = Array.from({ length: 10 }, (_, i) => i + 1) // 1..10

export function MarginStep() {
  const navigate = useNavigate()
  const { state, isDraw, winnerTeam, setWinnerGoals, buildGoals } =
    usePrediction()

  if (!state.outcome) return <Navigate to=".." replace />

  const choose = (n: number) => {
    setWinnerGoals(n)
    if (isDraw) {
      buildGoals()
      navigate('../timeline')
    } else {
      navigate('../opponent')
    }
  }

  const prompt = isDraw
    ? 'How many goals EACH? 🤝'
    : `How many will ${winnerTeam?.name} score? 🥅`

  return (
    <Screen title="The Margin" onBack={() => navigate(-1)} right={<ShareButton />}>
      <StepDots step={1} total={4} />
      <p className="px-6 text-center font-display text-2xl leading-tight">
        {prompt}
      </p>
      <div className="grid grid-cols-3 gap-3 p-4">
        {RANGE.map((n, i) => (
          <motion.button
            key={n}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.03 }}
            whileTap={{ x: 3, y: 3 }}
            onClick={() => choose(n)}
            className="grid aspect-square place-items-center rounded-3xl border-[3px] border-ink bg-white font-display text-4xl shadow-pop-lg active:shadow-none"
            style={{
              backgroundColor:
                winnerTeam && !isDraw
                  ? `color-mix(in srgb, ${winnerTeam.color} 14%, white)`
                  : undefined,
            }}
          >
            {n}
          </motion.button>
        ))}
      </div>
      <p className="px-6 pb-6 text-center text-sm font-bold text-ink/50">
        Bigger calls are worth more points. Be brave. 🔥
      </p>
    </Screen>
  )
}
