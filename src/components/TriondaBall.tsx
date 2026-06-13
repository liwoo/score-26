import { useId } from 'react'

/**
 * Stylized homage to the adidas Trionda — the FIFA World Cup 2026 match ball.
 * Three colored "onda" blades for the three host nations (USA / Canada /
 * Mexico) on a glossy white sphere. Not the official artwork — an original
 * cartoon interpretation that fits score26's sticker look.
 */
export function TriondaBall({ size = 48 }: { size?: number }) {
  const gid = useId()
  const blade = 'M50 50 C 42 38 44.5 21 50 12.5 C 55.5 21 58 38 50 50 Z'
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden
      style={{ display: 'block' }}
    >
      <defs>
        <radialGradient id={gid} cx="36%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="66%" stopColor="#eef0f3" />
          <stop offset="100%" stopColor="#ccd0d8" />
        </radialGradient>
      </defs>

      <circle
        cx="50"
        cy="50"
        r="47"
        fill={`url(#${gid})`}
        stroke="#1c1326"
        strokeWidth="3"
      />

      <g stroke="#1c1326" strokeWidth="1.4" strokeLinejoin="round">
        <g transform="rotate(-10 50 50)">
          <path d={blade} fill="#E4002B" />
          <path d={blade} fill="#0061B8" transform="rotate(120 50 50)" />
          <path d={blade} fill="#00984E" transform="rotate(240 50 50)" />
          <circle cx="50" cy="50" r="3" fill="#1c1326" />
        </g>
      </g>

      {/* gloss highlight */}
      <ellipse cx="36" cy="29" rx="13" ry="8" fill="#ffffff" opacity="0.5" />
    </svg>
  )
}
