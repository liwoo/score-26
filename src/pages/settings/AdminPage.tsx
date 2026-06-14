import { Navigate, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Screen } from '../../components/Screen'
import { getMatches } from '../../data/matches'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../features/auth/AuthProvider'
import { isAdmin } from '../../features/auth/admin'

type OutcomeRow = {
  match_id: number
  home_score: number
  away_score: number
  emails_done_at: string | null
}

export function AdminPage() {
  const navigate = useNavigate()
  const { email, loading } = useAuth()

  const { data: recorded = [] } = useQuery({
    queryKey: ['admin-outcomes'],
    enabled: isAdmin(email),
    queryFn: async (): Promise<OutcomeRow[]> => {
      const { data, error } = await supabase
        .from('match_outcomes')
        .select('match_id, home_score, away_score, emails_done_at')
      if (error) throw error
      return (data as OutcomeRow[]) ?? []
    },
  })

  if (loading) return null
  if (!isAdmin(email)) return <Navigate to="/settings" replace />

  const byId = new Map(recorded.map((r) => [r.match_id, r]))

  // Matches that have ended (or are live) — newest first.
  const matches = getMatches()
    .filter((m) => m.status === 'finished' || m.status === 'live')
    .sort((a, b) => +new Date(b.kickoff) - +new Date(a.kickoff))

  return (
    <Screen title="Record Results" onBack={() => navigate('/settings')}>
      <div className="space-y-4 p-4">
        <div className="rounded-3xl border-[3px] border-ink bg-grape/10 p-4 shadow-pop-lg">
          <p className="font-display text-lg">Admin · Match results ⚙️</p>
          <p className="mt-1 text-sm font-bold text-ink/60">
            Pick an ended match, enter the real stats and submit. That scores
            every prediction and emails the players automatically.
          </p>
        </div>

        {matches.length === 0 ? (
          <p className="py-8 text-center font-bold text-ink/40">
            No ended matches yet.
          </p>
        ) : (
          <div className="overflow-hidden rounded-3xl border-2 border-ink/10 bg-white">
            {matches.map((m) => {
              const rec = byId.get(Number(m.id))
              return (
                <button
                  key={m.id}
                  onClick={() => navigate(`/settings/admin/${m.id}`)}
                  className="flex w-full items-center gap-3 border-b-2 border-ink/5 px-4 py-3 text-left last:border-0 active:bg-cream"
                >
                  <span className="text-xl">{m.home.flag}</span>
                  <span className="text-xs font-extrabold text-ink/40">v</span>
                  <span className="text-xl">{m.away.flag}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-sm leading-tight">
                      {m.home.code} v {m.away.code}
                    </p>
                    <p className="text-xs font-bold text-ink/50">
                      {new Date(m.kickoff).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })}
                      {m.status === 'live' && ' · 🔴 live'}
                    </p>
                  </div>
                  {rec ? (
                    <span className="rounded-full border-2 border-ink bg-grass px-2.5 py-0.5 font-display text-xs text-white shadow-pop">
                      {rec.home_score}–{rec.away_score}
                      {rec.emails_done_at ? ' ✓' : ''}
                    </span>
                  ) : (
                    <span className="rounded-full border-2 border-ink/15 px-2.5 py-0.5 text-xs font-bold text-ink/40">
                      Record
                    </span>
                  )}
                  <span className="font-display text-xl text-ink/30">›</span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </Screen>
  )
}
