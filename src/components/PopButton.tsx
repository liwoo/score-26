import { motion } from 'motion/react'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'

type Variant = 'sun' | 'grass' | 'coral' | 'sky' | 'ink' | 'ghost'

const VARIANTS: Record<Variant, string> = {
  sun: 'bg-sun text-ink',
  grass: 'bg-grass text-white',
  coral: 'bg-coral text-white',
  sky: 'bg-sky text-ink',
  ink: 'bg-ink text-cream',
  ghost: 'bg-white text-ink',
}

type Props = Omit<
  ComponentPropsWithoutRef<'button'>,
  'onDrag' | 'onDragStart' | 'onDragEnd' | 'onAnimationStart' | 'onAnimationEnd'
> & {
  variant?: Variant
  full?: boolean
  children: ReactNode
}

/** The signature tactile button — presses down and the shadow collapses. */
export function PopButton({
  variant = 'sun',
  full,
  className = '',
  children,
  disabled,
  ...rest
}: Props) {
  return (
    <motion.button
      whileTap={disabled ? undefined : { x: 3, y: 3, boxShadow: '0 0 0 0 var(--color-ink)' }}
      transition={{ type: 'spring', stiffness: 900, damping: 30 }}
      disabled={disabled}
      className={[
        'font-display uppercase tracking-wide select-none',
        'rounded-2xl border-2 border-ink px-6 py-3 text-lg',
        'shadow-pop transition-colors',
        disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer',
        full ? 'w-full' : '',
        VARIANTS[variant],
        className,
      ].join(' ')}
      {...rest}
    >
      {children}
    </motion.button>
  )
}
