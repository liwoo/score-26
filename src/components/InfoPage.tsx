import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Screen } from './Screen'

export type InfoSection = {
  heading: string
  body: ReactNode
}

/** Shared reading layout for the legal / help screens under Settings. */
export function InfoPage({
  title,
  emoji,
  intro,
  updated,
  sections,
}: {
  title: string
  emoji: string
  intro: ReactNode
  updated?: string
  sections: InfoSection[]
}) {
  const navigate = useNavigate()

  return (
    <Screen title={title} onBack={() => navigate(-1)}>
      <div className="space-y-4 p-4">
        <div className="rounded-3xl border-[3px] border-ink bg-white p-5 shadow-pop-lg">
          <span className="text-4xl">{emoji}</span>
          <p className="mt-2 text-sm font-bold leading-relaxed text-ink/70">
            {intro}
          </p>
          {updated && (
            <p className="mt-3 text-[11px] font-extrabold uppercase tracking-wider text-ink/40">
              Last updated · {updated}
            </p>
          )}
        </div>

        {sections.map((s, i) => (
          <section
            key={s.heading}
            className="rounded-3xl border-2 border-ink/10 bg-white p-4"
          >
            <h2 className="flex items-baseline gap-2 font-display text-lg">
              <span className="font-display text-ink/30">{i + 1}.</span>
              {s.heading}
            </h2>
            <div className="mt-1.5 space-y-2 text-sm font-semibold leading-relaxed text-ink/70">
              {s.body}
            </div>
          </section>
        ))}

        <p className="px-2 pb-2 text-center text-xs font-bold text-ink/40">
          Questions? Reach us at hello@score26.app
        </p>
      </div>
    </Screen>
  )
}
