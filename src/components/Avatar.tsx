type Style = 'fun-emoji' | 'adventurer' | 'big-smile' | 'bottts'

/**
 * Caricature avatar via DiceBear — zero local assets, deterministic per seed.
 */
export function Avatar({
  seed,
  style = 'fun-emoji',
  size = 44,
  className = '',
}: {
  seed: string
  style?: Style
  size?: number
  className?: string
}) {
  const url = `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(
    seed,
  )}&radius=50&backgroundType=gradientLinear`
  return (
    <img
      src={url}
      width={size}
      height={size}
      alt=""
      className={`shrink-0 rounded-full border-2 border-ink bg-white object-cover ${className}`}
      style={{ width: size, height: size }}
      loading="lazy"
    />
  )
}
