import { useState } from 'react'
import { Avatar } from './Avatar'

/**
 * A player's real Wikipedia headshot, falling back to a generated caricature
 * when there's no photo (or the image fails to load).
 */
export function PlayerAvatar({
  name,
  photo,
  size = 42,
  className = '',
}: {
  name: string
  photo?: string | null
  size?: number
  className?: string
}) {
  const [broken, setBroken] = useState(false)

  if (!photo || broken) {
    return <Avatar seed={name} style="adventurer" size={size} className={className} />
  }

  return (
    <img
      src={photo}
      width={size}
      height={size}
      alt=""
      onError={() => setBroken(true)}
      className={`shrink-0 rounded-full border-2 border-ink bg-white object-cover ${className}`}
      style={{ width: size, height: size }}
      loading="lazy"
    />
  )
}
