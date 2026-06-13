/**
 * A national flag clipped to fill a circle. Renders a flagcdn.com image by code
 * (ISO 3166-1 alpha-2 like `br`, or a subdivision like `gb-sct`), so every World
 * Cup nation — including the UK home nations — is supported.
 */
export function Flag({
  iso,
  size = 44,
  ring,
  bordered = true,
  shadow = true,
  boxShadow,
  className = '',
}: {
  iso: string
  size?: number
  /** Accent ring color (e.g. team color) drawn outside the border. */
  ring?: string
  bordered?: boolean
  shadow?: boolean
  /** Explicit box-shadow override (wins over ring/shadow). */
  boxShadow?: string
  className?: string
}) {
  const code = (iso ?? '').toLowerCase()
  const src = `https://flagcdn.com/w160/${code}.png`

  const computedShadow =
    boxShadow ??
    (ring
      ? `0 0 0 4px ${ring}${shadow ? ', 3px 3px 0 0 var(--color-ink)' : ''}`
      : shadow
        ? '3px 3px 0 0 var(--color-ink)'
        : undefined)

  return (
    <span
      role="img"
      aria-label={iso}
      className={`relative inline-block shrink-0 overflow-hidden bg-white ${
        bordered ? 'border-2 border-ink' : ''
      } ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        boxShadow: computedShadow,
      }}
    >
      {code ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <span
          className="grid h-full w-full place-items-center"
          style={{ fontSize: size * 0.6 }}
        >
          🏳️
        </span>
      )}
    </span>
  )
}
