import type { ReactNode } from 'react'

/**
 * Arcade backdrop with a centered mobile viewport. On phones it fills the
 * screen; on desktop it floats as a device-like card.
 */
export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-grape">
      {/* layered arcade atmosphere */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 90% at 50% -10%, #7b3fb0 0%, #5b2a86 45%, #3a1a5c 100%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            'radial-gradient(var(--color-sun) 1.5px, transparent 1.6px)',
          backgroundSize: '22px 22px',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 opacity-30"
        style={{
          background:
            'repeating-linear-gradient(90deg, transparent 0 38px, rgba(255,255,255,.12) 38px 40px)',
        }}
      />

      <div className="relative flex h-[100dvh] items-stretch justify-center sm:py-5">
        <div
          className="relative flex h-[100dvh] w-full max-w-[440px] flex-col overflow-hidden bg-cream sm:h-[min(900px,calc(100dvh-2.5rem))] sm:rounded-[2.75rem] sm:border-[3px] sm:border-ink sm:shadow-pop-xl"
        >
          {children}
        </div>
      </div>
    </div>
  )
}
