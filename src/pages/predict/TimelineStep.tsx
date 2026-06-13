import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { AnimatePresence, motion } from 'motion/react'
import { Ball } from '../../components/Ball'
import { PopButton } from '../../components/PopButton'
import { GoalModal } from '../../components/GoalModal'
import { TimelineGuideModal } from '../../components/TimelineGuideModal'
import { BUCKETS } from '../../data/timeline'
import { POINTS } from '../../lib/scoring'
import type { Team } from '../../data/types'
import {
  usePrediction,
  type GoalPick,
  type Side,
} from '../../features/prediction/PredictionContext'

function DraggableBall({
  goal,
  team,
  onTap,
}: {
  goal: GoalPick
  team: Team
  onTap?: () => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: goal.id,
  })
  const scorer = team.squad.find((p) => p.id === goal.scorerId)
  const complete = goal.scorerId != null && goal.assistId != null
  // ? = needs scorer, orange number = scorer set/assist pending, green = done
  const badgeColor = !scorer
    ? 'bg-sun text-ink'
    : complete
      ? 'bg-grass text-white'
      : 'bg-tangerine text-ink'
  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onTap}
      className="relative touch-none"
      style={{ opacity: isDragging ? 0 : 1 }}
    >
      <Ball iso={team.iso} size={48} />
      {/* scorer + assist status badge */}
      <span
        className={`absolute -bottom-1 -right-1 grid size-5 place-items-center rounded-full border-2 border-ink text-[10px] font-extrabold ${badgeColor}`}
      >
        {scorer ? scorer.number : '?'}
      </span>
    </button>
  )
}

function BucketZone({
  bucketId,
  label,
  children,
}: {
  bucketId: number
  label: string
  children: React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `bucket-${bucketId}` })
  const empty = !children || (Array.isArray(children) && children.length === 0)
  return (
    <div className="flex items-stretch gap-2">
      <div className="flex w-14 shrink-0 items-center justify-end">
        <span className="font-display text-sm text-ink/50">{label}</span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex min-h-[52px] flex-1 flex-wrap items-center gap-2 rounded-2xl border-2 px-2 py-1.5 transition-colors ${
          isOver
            ? 'border-coral bg-coral/15 border-solid'
            : empty
              ? 'border-dashed border-ink/20 bg-white/40'
              : 'border-ink/30 border-solid bg-white'
        }`}
      >
        {empty && (
          <span className="select-none text-xs font-bold text-ink/25">
            {isOver ? 'Drop it here! 🎯' : ''}
          </span>
        )}
        {children}
      </div>
    </div>
  )
}

export function TimelineStep() {
  const navigate = useNavigate()
  const {
    state,
    match,
    scoreline,
    allPlaced,
    allScored,
    allAssisted,
    placeGoal,
    setScorer,
    setAssist,
  } = usePrediction()

  const [activeId, setActiveId] = useState<string | null>(null)
  const [editGoalId, setEditGoalId] = useState<string | null>(null)
  // Show the "how the timeline works" guide on arrival.
  const [showGuide, setShowGuide] = useState(true)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  )

  if (state.goals.length === 0) return <Navigate to=".." replace />

  // Max bonus forfeited by submitting scoreline-only: timing+scorer+assist per
  // goal, plus the perfect-prediction bonus.
  const forfeitPoints =
    (POINTS.goalTiming + POINTS.goalScorer + POINTS.goalAssister) *
      state.goals.length +
    POINTS.perfect

  const teamOf = (side: Side): Team => (side === 'home' ? match.home : match.away)

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id))
  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null)
    const goalId = String(e.active.id)
    const over = e.over?.id ? String(e.over.id) : null
    if (over?.startsWith('bucket-')) {
      const bucket = Number(over.replace('bucket-', ''))
      placeGoal(goalId, bucket)
      setEditGoalId(goalId) // tap → drag → tap: pick scorer + assist right away
    } else if (over === 'tray') {
      placeGoal(goalId, null)
    }
  }

  const unplaced = state.goals.filter((g) => g.bucket == null)
  const activeGoal = state.goals.find((g) => g.id === activeId) ?? null
  const editGoal = state.goals.find((g) => g.id === editGoalId) ?? null
  const placedCount = state.goals.length - unplaced.length

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="flex h-full min-h-0 flex-col">
        {/* header */}
        <header className="flex items-center gap-3 border-b-2 border-ink/10 px-4 py-3">
          <button
            onClick={() => navigate(-1)}
            aria-label="Back"
            className="grid size-10 place-items-center rounded-full border-2 border-ink bg-white shadow-pop"
          >
            <span className="font-display text-xl leading-none">‹</span>
          </button>
          <div className="flex-1 text-center">
            <h1 className="font-display text-lg leading-tight">Place the Goals</h1>
            <p className="text-xs font-bold text-ink/50">
              {match.home.flag} {scoreline} {match.away.flag}
            </p>
          </div>
          <span className="grid size-10 place-items-center rounded-full border-2 border-ink bg-sun font-display text-sm shadow-pop">
            {placedCount}/{state.goals.length}
          </span>
        </header>

        {/* timeline (top = 90'+, bottom = 0') */}
        <div className="no-scrollbar min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 py-3">
          <p className="pb-1 text-center text-xs font-extrabold uppercase tracking-wider text-coral">
            ▲ Full time
          </p>
          {[...BUCKETS].reverse().map((b) => (
            <BucketZone key={b.id} bucketId={b.id} label={b.label}>
              {state.goals
                .filter((g) => g.bucket === b.id)
                .map((g) => (
                  <DraggableBall
                    key={g.id}
                    goal={g}
                    team={teamOf(g.side)}
                    onTap={() => setEditGoalId(g.id)}
                  />
                ))}
            </BucketZone>
          ))}
          <p className="pt-1 text-center text-xs font-extrabold uppercase tracking-wider text-grass">
            ▼ Kick off
          </p>
        </div>

        {/* tray + submit */}
        <TrayAndSubmit
          unplaced={unplaced}
          teamOf={teamOf}
          allPlaced={allPlaced}
          allScored={allScored}
          allAssisted={allAssisted}
          onTapBall={(id) => setEditGoalId(id)}
          onSubmit={() => navigate('../submit')}
        />
      </div>

      <DragOverlay dropAnimation={null}>
        {activeGoal ? (
          <Ball iso={teamOf(activeGoal.side).iso} size={48} dragging />
        ) : null}
      </DragOverlay>

      <GoalModal
        open={editGoal != null}
        team={editGoal ? teamOf(editGoal.side) : null}
        minuteLabel={
          editGoal?.bucket != null ? BUCKETS[editGoal.bucket].label : null
        }
        scorerId={editGoal?.scorerId ?? null}
        assistId={editGoal?.assistId ?? null}
        onPickScorer={(playerId) => {
          if (editGoal) setScorer(editGoal.id, playerId)
        }}
        onPickAssist={(playerId) => {
          if (editGoal) setAssist(editGoal.id, playerId)
          setEditGoalId(null)
        }}
        onClose={() => setEditGoalId(null)}
      />

      <TimelineGuideModal
        open={showGuide}
        forfeitPoints={forfeitPoints}
        onContinue={() => setShowGuide(false)}
        onSkip={() => navigate('../submit')}
      />
    </DndContext>
  )
}

function TrayAndSubmit({
  unplaced,
  teamOf,
  allPlaced,
  allScored,
  allAssisted,
  onTapBall,
  onSubmit,
}: {
  unplaced: GoalPick[]
  teamOf: (s: Side) => Team
  allPlaced: boolean
  allScored: boolean
  allAssisted: boolean
  onTapBall: (id: string) => void
  onSubmit: () => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: 'tray' })
  const ready = allPlaced && allScored && allAssisted

  return (
    <footer className="border-t-2 border-ink/10 bg-cream/95 px-4 py-3">
      <div
        ref={setNodeRef}
        className={`mb-3 flex min-h-[58px] flex-wrap items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-3 py-2 transition-colors ${
          isOver ? 'border-coral bg-coral/10' : 'border-ink/20'
        }`}
      >
        <AnimatePresence mode="popLayout">
          {unplaced.length > 0 ? (
            unplaced.map((g) => (
              <motion.div
                key={g.id}
                layout
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 24 }}
              >
                <DraggableBall
                  goal={g}
                  team={teamOf(g.side)}
                  onTap={() => onTapBall(g.id)}
                />
              </motion.div>
            ))
          ) : (
            <p className="text-center text-sm font-bold text-ink/50">
              {ready
                ? '🎉 Every goal placed, scored and assisted!'
                : 'Tap a ball above to pick scorer + assist ⬆️'}
            </p>
          )}
        </AnimatePresence>
      </div>

      <p className="mb-2 text-center text-xs font-bold text-ink/50">
        {!allPlaced
          ? 'Drag each ball onto the minute you think it’s scored.'
          : !allScored
            ? 'Now tap each ball to choose who scores.'
            : !allAssisted
              ? 'One more tap per ball — who got the assist?'
              : 'Looking good — lock it in!'}
      </p>

      <PopButton variant="grass" full disabled={!ready} onClick={onSubmit}>
        {ready ? '✅ Submit Prediction' : 'Finish Your Picks'}
      </PopButton>
    </footer>
  )
}
