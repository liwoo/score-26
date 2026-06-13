import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  // Fail loud in dev so a missing .env doesn't surface as a confusing 401.
  console.warn('Supabase env vars missing — squads will not load.')
}

export const supabase = createClient(url ?? '', anonKey ?? '')
