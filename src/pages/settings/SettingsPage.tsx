import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Screen } from '../../components/Screen'
import { Avatar } from '../../components/Avatar'
import { Flag } from '../../components/Flag'
import { PopButton } from '../../components/PopButton'
import { getMatches } from '../../data/matches'
import { MAX_PREDICTIONS } from '../../data/profile'
import { getMyCounts } from '../../data/submissions'
import { useAuth } from '../../features/auth/AuthProvider'
import { notificationPermission, requestNotifications } from '../../lib/pwa'

type LinkItem = { to: string; emoji: string; label: string; hint: string }

const LINKS: LinkItem[] = [
  { to: '/settings/help', emoji: '💡', label: 'Help & Support', hint: 'How to play, FAQs' },
  { to: '/settings/policy', emoji: '🔒', label: 'Privacy Policy', hint: 'What we store' },
  { to: '/settings/terms', emoji: '📜', label: 'Terms of Service', hint: 'The fair-play rules' },
]

export function SettingsPage() {
  const navigate = useNavigate()
  const { email, profile, signOut } = useAuth()
  const [perm, setPerm] = useState(notificationPermission())

  const { data: counts = {} } = useQuery({
    queryKey: ['my-counts', email],
    enabled: !!email,
    queryFn: () => getMyCounts(email!),
  })

  const matchById = new Map(getMatches().map((m) => [m.id, m]))
  const mySessions = Object.entries(counts)
    .filter(([, n]) => n > 0)
    .map(([id, n]) => ({ match: matchById.get(id), count: n }))
    .filter((s) => s.match != null)

  return (
    <Screen title="Settings" onBack={() => navigate('/')}>
      <div className="space-y-4 p-4">
        {/* Account */}
        {profile ? (
          <div className="rounded-3xl border-[3px] border-ink bg-white p-4 shadow-pop-lg">
            <div className="flex items-center gap-3">
              <Avatar seed={profile.avatarSeed} size={52} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-lg leading-tight">
                  {profile.username}
                </p>
                <p className="flex items-center gap-1.5 text-xs font-bold text-ink/50">
                  <Flag iso={profile.country.iso} size={14} shadow={false} />
                  {profile.country.name} · {email}
                </p>
              </div>
            </div>
            <PopButton
              variant="ghost"
              full
              className="mt-4 text-base"
              onClick={() => signOut()}
            >
              🚪 Log out
            </PopButton>
          </div>
        ) : (
          <div className="rounded-3xl border-[3px] border-ink bg-grape/10 p-4 text-center shadow-pop-lg">
            <p className="font-display text-xl">You're playing as a guest 👋</p>
            <p className="mt-1 text-sm font-bold text-ink/60">
              {email
                ? 'Finish setting up your profile to climb the leaderboard.'
                : 'Sign in with Google to save your predictions and climb the leaderboard.'}
            </p>
            <PopButton
              variant="coral"
              full
              className="mt-4 text-lg"
              onClick={() => navigate('/settings/signup')}
            >
              {email ? '✨ Finish profile' : '⚡ Sign up'}
            </PopButton>
          </div>
        )}

        {/* My Sessions */}
        <section>
          <h2 className="px-1 pb-2 font-display text-lg">My Sessions</h2>
          <div className="overflow-hidden rounded-3xl border-2 border-ink/10 bg-white">
            {mySessions.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm font-bold text-ink/40">
                No predictions yet — your match sessions will show up here once you
                lock one in. ⚽
              </p>
            ) : (
              <ul>
                {mySessions.map(({ match, count }) => {
                  const m = match!
                  const left = Math.max(0, MAX_PREDICTIONS - count)
                  return (
                    <li key={m.id}>
                      <button
                        onClick={() => navigate(`/settings/match/${m.id}`)}
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
                            {count}/{MAX_PREDICTIONS} predictions ·{' '}
                            {left > 0 ? `${left} left` : 'all used'} · tap for details
                          </p>
                        </div>
                        <span className="font-display text-xl text-ink/30">›</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </section>

        {/* Notifications */}
        <section>
          <h2 className="px-1 pb-2 font-display text-lg">Notifications</h2>
          <div className="flex items-center gap-3 rounded-3xl border-2 border-ink/10 bg-white px-4 py-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl border-2 border-ink/10 bg-cream text-lg">
              🔔
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-base leading-tight">
                Full-time results
              </p>
              <p className="text-xs font-bold text-ink/50">
                {perm === 'granted'
                  ? 'On — we’ll ping you when scores land'
                  : perm === 'denied'
                    ? 'Blocked — enable in your browser settings'
                    : perm === 'unsupported'
                      ? 'Not available on this device'
                      : 'Get pinged when your match scores are in'}
              </p>
            </div>
            {perm === 'default' && (
              <button
                onClick={async () => setPerm(await requestNotifications(true))}
                className="rounded-full border-2 border-ink bg-sun px-3 py-1 font-display text-xs shadow-pop active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
              >
                Enable
              </button>
            )}
            {perm === 'granted' && <span className="text-xl">✅</span>}
          </div>
        </section>

        {/* About & legal */}
        <section>
          <h2 className="px-1 pb-2 font-display text-lg">About</h2>
          <div className="overflow-hidden rounded-3xl border-2 border-ink/10 bg-white">
            {LINKS.map((l) => (
              <button
                key={l.to}
                onClick={() => navigate(l.to)}
                className="flex w-full items-center gap-3 border-b-2 border-ink/5 px-4 py-3 text-left last:border-0 active:bg-cream"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-xl border-2 border-ink/10 bg-cream text-lg">
                  {l.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-base leading-tight">
                    {l.label}
                  </p>
                  <p className="truncate text-xs font-bold text-ink/50">{l.hint}</p>
                </div>
                <span className="font-display text-xl text-ink/30">›</span>
              </button>
            ))}
          </div>
        </section>

        <p className="pb-2 text-center text-xs font-bold text-ink/40">
          Score26 · World Cup 2026 · v{__APP_VERSION__}
        </p>
      </div>
    </Screen>
  )
}
