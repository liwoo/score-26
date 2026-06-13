import { Flag } from './Flag'

/** A national flag filling a chunky circular avatar, with an optional team-color ring. */
export function FlagBadge({
  iso,
  size = 64,
  ring,
  className = '',
}: {
  iso: string
  size?: number
  ring?: string
  className?: string
}) {
  return <Flag iso={iso} size={size} ring={ring} className={className} />
}
