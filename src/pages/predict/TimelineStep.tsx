import { useMemo, useState } from 'react'
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
import { BUCKETS, bucketsForMatch } from '../../data/timeline'
import { POINTS } from '../../lib/scoring'
import { useSquad } from '../../data/useSquad'
import type { Team } from '../../data/types'
import {
  NO_ASSIST,
  OWN_GOAL,
  usePrediction,
  type GoalPick,
  type Side,
} from '../../features/prediction/PredictionContext'

function DraggableBall({
  goal,
  team,
  numberById,
  onTap,
  bounce = false,
  bounceDelay = 0,
}: {
  goal: GoalPick
  team: Team
  /** Player id → jersey number, from the loaded squads. */
  numberById: Map<string, number>
  onTap?: () => void
  /** Subtly bob to signal "drag me" (used for unplaced tray balls). */
  bounce?: boolean
  bounceDelay?: number
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: goal.id,
  })
  const isOwnGoal = goal.scorerId === OWN_GOAL
  const scorerNo =
    !isOwnGoal && goal.scorerId ? numberById.get(goal.scorerId) : undefined
  const scorerLabel = isOwnGoal ? 'OG' : (scorerNo ?? '?')
  // NO_ASSIST = solo goal (and own goals have no assist), so no assister jersey.
  const assistNo =
    goal.assistId && goal.assistId !== NO_ASSIST
      ? numberById.get(goal.assistId)
      : undefined
  const complete = goal.scorerId != null && goal.assistId != null
  // ? = needs scorer, orange number = scorer set/assist pending, green = done
  const badgeColor =
    goal.scorerId == null
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
      <motion.span
        className="relative block"
        animate={bounce ? { y: [0, -6, 0] } : { y: 0 }}
        transition={
          bounce
            ? {
                duration: 1.1,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: bounceDelay,
              }
            : { duration: 0.2 }
        }
      >
        <Ball iso={team.iso} size={48} />
        {/* assist jersey (small, muted) + scorer jersey (prominent) */}
        <span className="absolute -bottom-1 -right-1 flex items-center gap-0.5">
          {assistNo != null && (
            <span
              title="Assist"
              className="grid size-4 place-items-center rounded-full border border-ink bg-white text-[8px] font-extrabold leading-none text-ink/70"
            >
              {assistNo}
            </span>
          )}
          <span
            className={`grid size-5 place-items-center rounded-full border-2 border-ink font-extrabold leading-none ${badgeColor} ${
              isOwnGoal ? 'text-[8px]' : 'text-[10px]'
            }`}
          >
            {scorerLabel}
          </span>
        </span>
      </motion.span>
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
  // Tapping an un-placed (tray) ball pops a quick "drag me up" hint.
  const [showDragHint, setShowDragHint] = useState(false)

  // Squads (cached from the goal picker) let the balls show jersey numbers —
  // the static team.squad is empty in the prediction flow.
  const { data: homeSquad = [] } = useSquad(match.home.code)
  const { data: awaySquad = [] } = useSquad(match.away.code)
  const numberById = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of [...homeSquad, ...awaySquad]) m.set(p.id, p.number)
    return m
  }, [homeSquad, awaySquad])

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

  // Knockout ties can go to extra time, so they get the two ET brackets too.
  const timelineBuckets = bucketsForMatch(match.knockout)

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
            ▲ {match.knockout ? 'Extra time' : 'Full time'}
          </p>
          {[...timelineBuckets].reverse().map((b) => (
            <BucketZone key={b.id} bucketId={b.id} label={b.label}>
              {state.goals
                .filter((g) => g.bucket === b.id)
                .map((g) => (
                  <DraggableBall
                    key={g.id}
                    goal={g}
                    team={teamOf(g.side)}
                    numberById={numberById}
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
          numberById={numberById}
          allPlaced={allPlaced}
          allScored={allScored}
          allAssisted={allAssisted}
          onTapBall={() => setShowDragHint(true)}
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

      <DragHintModal
        open={showDragHint}
        iso={match.home.iso}
        onClose={() => setShowDragHint(false)}
      />
    </DndContext>
  )
}

function TrayAndSubmit({
  unplaced,
  teamOf,
  numberById,
  allPlaced,
  allScored,
  allAssisted,
  onTapBall,
  onSubmit,
}: {
  unplaced: GoalPick[]
  teamOf: (s: Side) => Team
  numberById: Map<string, number>
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
            unplaced.map((g, i) => (
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
                  numberById={numberById}
                  bounce
                  bounceDelay={i * 0.15}
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

/**
 * Quick "you have to drag, not tap" hint — shown when a player taps a ball that
 * hasn't been dropped onto the timeline yet. Animates a ball swiping up into a
 * time slot to demonstrate the gesture.
 */
function DragHintModal({
  open,
  iso,
  onClose,
}: {
  open: boolean
  iso: string
  onClose: () => void
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="absolute inset-0 z-50 grid place-items-center p-5"
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
            className="relative w-full max-w-xs rounded-[2rem] border-[3px] border-ink bg-cream p-5 text-center shadow-pop-xl"
          >
            <h2 className="font-display text-2xl leading-none">Drag it up! 👆</h2>

            {/* animated swipe demo */}
            <div className="relative mx-auto my-4 h-32 w-28">
              {/* target time slot */}
              <div className="absolute inset-x-0 top-0 mx-auto w-max rounded-xl border-2 border-dashed border-coral/70 px-3 py-2 font-display text-[11px] text-coral">
                20–30'
              </div>
              {/* ball travelling up into the slot, looping */}
              <motion.div
                className="absolute inset-x-0 bottom-0 mx-auto w-12"
                animate={{ y: [0, -72, -72, 0] }}
                transition={{
                  duration: 2.2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  times: [0, 0.55, 0.82, 1],
                }}
              >
                <div className="relative">
                  <Ball iso={iso} size={48} />
                  <motion.span
                    className="absolute -bottom-2 -right-3 text-2xl"
                    animate={{ rotate: [0, -14, 0] }}
                    transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    👆
                  </motion.span>
                </div>
              </motion.div>
            </div>

            <p className="text-sm font-bold text-ink/60">
              Press and <span className="text-ink">drag</span> each ball up onto the
              minute window you think the goal is scored in — then tap it to pick
              the scorer.
            </p>

            <PopButton variant="grass" full className="mt-5" onClick={onClose}>
              Got it!
            </PopButton>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
