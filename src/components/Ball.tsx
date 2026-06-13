import { Flag } from './Flag'

/** A goal-ball: a national flag filling the circle, with a glossy ball highlight. */
export function Ball({
  iso,
  size = 52,
  dragging = false,
  dimmed = false,
}: {
  iso: string
  size?: number
  dragging?: boolean
  dimmed?: boolean
}) {
  return (
    <span
      className="relative inline-grid place-items-center"
      style={{ width: size, height: size, opacity: dimmed ? 0.35 : 1 }}
    >
      <Flag
        iso={iso}
        size={size}
        boxShadow={
          dragging
            ? '6px 10px 0 0 rgba(28,19,38,.35)'
            : '3px 3px 0 0 var(--color-ink)'
        }
      />
      {/* glossy shine to keep the ball feel */}
      <span
        aria-hidden
        className="pointer-events-none absolute left-[20%] top-[15%] h-[24%] w-[24%] rounded-full bg-white/55 blur-[1px]"
      />
    </span>
  )
}
