import type { ReactNode } from 'react'
import { motion } from 'motion/react'

/** Standard in-app screen: optional header, scrollable body, sticky footer. */
export function Screen({
  title,
  onBack,
  right,
  footer,
  children,
  bodyClassName = '',
}: {
  title?: ReactNode
  onBack?: () => void
  right?: ReactNode
  footer?: ReactNode
  children: ReactNode
  bodyClassName?: string
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      {(title || onBack || right) && (
        <header className="z-10 flex items-center gap-3 border-b-2 border-ink/10 px-4 py-3">
          {onBack ? (
            <button
              onClick={onBack}
              aria-label="Back"
              className="grid size-10 place-items-center rounded-full border-2 border-ink bg-white shadow-pop active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
            >
              <span className="font-display text-xl leading-none">‹</span>
            </button>
          ) : (
            <span className="size-10" />
          )}
          <h1 className="flex-1 truncate text-center font-display text-xl tracking-wide">
            {title}
          </h1>
          <span className="flex size-10 items-center justify-end">{right}</span>
        </header>
      )}

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className={`no-scrollbar min-h-0 flex-1 overflow-y-auto ${bodyClassName}`}
      >
        {children}
      </motion.div>

      {footer && (
        <footer className="border-t-2 border-ink/10 bg-cream/95 px-4 py-3 backdrop-blur">
          {footer}
        </footer>
      )}
    </div>
  )
}
