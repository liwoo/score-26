import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { countryByIso, type Country } from '../../data/profile'

export type Profile = {
  email: string
  username: string
  avatarSeed: string
  countryIso: string
  country: Country
}

type ProfileRow = {
  email: string
  username: string
  avatar_seed: string | null
  country_iso: string | null
}

function toProfile(row: ProfileRow): Profile {
  return {
    email: row.email,
    username: row.username,
    avatarSeed: row.avatar_seed ?? 'Champion',
    countryIso: row.country_iso ?? 'mw',
    country: countryByIso(row.country_iso),
  }
}

type AuthValue = {
  /** Supabase session (null = signed out). */
  session: Session | null
  user: User | null
  email: string | null
  /** App profile row, or null if signed in but profile not yet created. */
  profile: Profile | null
  /** True until the initial session + profile lookup settles. */
  loading: boolean
  signInWithGoogle: (redirectTo?: string) => Promise<void>
  signOut: () => Promise<void>
  saveProfile: (p: {
    username: string
    avatarSeed: string
    countryIso: string
  }) => Promise<void>
}

const Ctx = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = useCallback(async (email: string | undefined) => {
    if (!email) {
      setProfile(null)
      return
    }
    const { data } = await supabase
      .from('profiles')
      .select('email, username, avatar_seed, country_iso')
      .eq('email', email)
      .maybeSingle()
    setProfile(data ? toProfile(data as ProfileRow) : null)
  }, [])

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return
      setSession(data.session)
      await fetchProfile(data.session?.user.email)
      if (active) setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess)
      fetchProfile(sess?.user.email)
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [fetchProfile])

  const signInWithGoogle = useCallback(async (redirectTo?: string) => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectTo ?? window.location.href,
        queryParams: { prompt: 'select_account' },
      },
    })
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setProfile(null)
  }, [])

  const saveProfile = useCallback<AuthValue['saveProfile']>(
    async ({ username, avatarSeed, countryIso }) => {
      const email = session?.user.email
      if (!email) throw new Error('Not signed in')
      const { error } = await supabase
        .from('profiles')
        .upsert(
          {
            email,
            username,
            avatar_seed: avatarSeed,
            country_iso: countryIso,
          },
          { onConflict: 'email' },
        )
      if (error) throw error
      await fetchProfile(email)
    },
    [session, fetchProfile],
  )

  const value = useMemo<AuthValue>(
    () => ({
      session,
      user: session?.user ?? null,
      email: session?.user.email ?? null,
      profile,
      loading,
      signInWithGoogle,
      signOut,
      saveProfile,
    }),
    [session, profile, loading, signInWithGoogle, signOut, saveProfile],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
