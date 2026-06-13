import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { Screen } from '../../components/Screen'
import { Avatar } from '../../components/Avatar'
import { Flag } from '../../components/Flag'
import { PopButton } from '../../components/PopButton'
import { COUNTRIES, SEEDS } from '../../data/profile'
import { useAuth } from '../../features/auth/AuthProvider'

export function SignupPage() {
  const navigate = useNavigate()
  const { email, profile, loading, signInWithGoogle, saveProfile } = useAuth()
  const [username, setUsername] = useState('')
  const [seedIdx, setSeedIdx] = useState(0)
  const [country, setCountry] = useState(COUNTRIES[0])
  const [saving, setSaving] = useState(false)

  // Already has a profile? Back to the hub.
  if (profile) return <Navigate to="/settings" replace />

  const create = async () => {
    setSaving(true)
    try {
      await saveProfile({
        username: username.trim(),
        avatarSeed: SEEDS[seedIdx],
        countryIso: country.iso,
      })
      navigate('/settings', { replace: true })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Screen title="Create Profile" onBack={() => navigate(-1)}>
      <div className="space-y-4 p-4">
        <div className="rounded-3xl border-[3px] border-ink bg-grape/10 p-4 text-center shadow-pop-lg">
          <p className="font-display text-xl">Join the board ⚡</p>
          <p className="mt-1 text-sm font-bold text-ink/60">
            Sign in with Google, then pick a name — it saves your predictions and
            ranks you against everyone else.
          </p>
        </div>

        {loading ? (
          <div className="rounded-3xl border-[3px] border-ink bg-white p-6 text-center font-bold text-ink/40 shadow-pop-lg">
            Checking your session…
          </div>
        ) : !email ? (
          <button
            onClick={() => signInWithGoogle(`${window.location.origin}/settings/signup`)}
            className="flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-ink bg-white px-4 py-3 font-display text-lg shadow-pop active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
          >
            <GoogleG /> Continue with Google
          </button>
        ) : (
          <>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4 rounded-3xl border-[3px] border-ink bg-white p-4 shadow-pop-lg"
            >
              <p className="text-center font-display text-xl">Make it yours ✨</p>
              <p className="truncate text-center text-xs font-bold text-ink/50">
                Signed in as {email}
              </p>

              <div className="flex flex-col items-center gap-2">
                <Avatar seed={SEEDS[seedIdx]} size={84} />
                <button
                  onClick={() => setSeedIdx((i) => (i + 1) % SEEDS.length)}
                  className="rounded-full border-2 border-ink bg-sun px-3 py-1 text-sm font-extrabold shadow-pop active:translate-y-[2px] active:shadow-none"
                >
                  🎲 Shuffle avatar
                </button>
              </div>

              <label className="block">
                <span className="text-xs font-extrabold uppercase tracking-wider text-ink/50">
                  Username
                </span>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. GoalGremlin"
                  maxLength={16}
                  className="mt-1 w-full rounded-2xl border-2 border-ink bg-cream px-4 py-2.5 font-display text-lg outline-none focus:bg-white"
                />
              </label>

              <div>
                <span className="text-xs font-extrabold uppercase tracking-wider text-ink/50">
                  Country
                </span>
                <div className="no-scrollbar mt-1 flex gap-2 overflow-x-auto pb-1">
                  {COUNTRIES.map((c) => (
                    <button
                      key={c.name}
                      onClick={() => setCountry(c)}
                      className={`flex shrink-0 items-center gap-1.5 rounded-full border-2 border-ink px-3 py-1.5 text-sm font-bold ${
                        country.name === c.name ? 'bg-ink text-cream' : 'bg-white'
                      }`}
                    >
                      <Flag iso={c.iso} size={18} shadow={false} />
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>

            <PopButton
              variant="coral"
              full
              className="text-xl"
              disabled={username.trim().length < 3 || saving}
              onClick={create}
            >
              {saving ? 'Saving…' : '🚀 Create & Join'}
            </PopButton>
          </>
        )}
      </div>
    </Screen>
  )
}

function GoogleG() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.4 30.1 0 24 0 14.6 0 6.4 5.4 2.5 13.3l7.8 6.1C12.2 13.2 17.6 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.4 5.7c4.3-4 6.8-9.9 6.8-17.4z" />
      <path fill="#FBBC05" d="M10.3 28.6c-.5-1.5-.8-3-.8-4.6s.3-3.1.8-4.6l-7.8-6.1C.9 16.5 0 20.1 0 24s.9 7.5 2.5 10.7l7.8-6.1z" />
      <path fill="#34A853" d="M24 48c6.1 0 11.3-2 15-5.5l-7.4-5.7c-2 1.4-4.7 2.3-7.6 2.3-6.4 0-11.8-3.7-13.7-9.1l-7.8 6.1C6.4 42.6 14.6 48 24 48z" />
    </svg>
  )
}
