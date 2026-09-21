import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  // Fails loudly in the console rather than silently no-op-ing every auth call —
  // easy to miss a missing .env.local (dev) or Netlify env var (prod) otherwise.
  console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — check .env.local (see BUILD_PLAN.md).')
}

export const supabase = createClient(url ?? '', anonKey ?? '')
