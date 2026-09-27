import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabaseClient'
import { hashPin } from '../lib/pin'
import { db, switchDatabaseFor } from '../db/db'
import { claimLegacyData, hasLegacyData } from '../db/authRepo'
import { ensureSiniestrosCategory, fixupRenamedSubcategories, seedIfEmpty } from '../db/seed'
import { ensureRecurringTransactionsForCurrentMonth } from '../db/repo'
import { syncNow } from '../db/sync'

// Once a device has answered "claim my old data or start fresh," it never asks
// again — even for a different person logging into the same device afterward.
const CLAIM_DECIDED_KEY = 'finanzas.legacyClaimDecided'

type Phase =
  | 'loading' // resolving whether a Supabase session already exists
  | 'signedOut' // show the email entry screen
  | 'claimChoice' // legacy pre-accounts local data found, undecided what to do with it
  | 'needsPin' // logged in, no PIN set yet for this person's local database
  | 'needsRecurringOnboarding' // fresh profile, hasn't seen the salary/recurring step yet
  | 'locked' // PIN set, not entered yet this app open
  | 'unlocked' // render the real app

interface AuthContextValue {
  phase: Phase
  email: string | null
  sendMagicLink: (email: string) => Promise<{ error: string | null }>
  claim: (choice: 'claim' | 'fresh') => Promise<void>
  setupPin: (pin: string) => Promise<void>
  unlock: (pin: string) => Promise<boolean>
  finishRecurringOnboarding: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

// After the local database for this session is settled (freshly claimed, freshly
// seeded, or just reopened), figures out which gate screen — if any — still needs
// showing before the real app can render.
async function nextPhaseAfterDatabaseReady(): Promise<Phase> {
  const settings = await db.userSettings.get('default')
  if (!settings?.pinHash) return 'needsPin'
  if (!settings.recurringOnboardingDone) return 'needsRecurringOnboarding'
  return 'locked'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>('loading')
  const [email, setEmail] = useState<string | null>(null)

  async function prepareForUser(userId: string, userEmail: string | null) {
    setEmail(userEmail)
    switchDatabaseFor(userId)

    const isFirstOpen = (await db.categories.count()) === 0
    if (isFirstOpen) {
      const legacyHasData = await hasLegacyData()
      if (legacyHasData && localStorage.getItem(CLAIM_DECIDED_KEY) !== 'true') {
        setPhase('claimChoice')
        return
      }
      await seedIfEmpty()
      localStorage.setItem(CLAIM_DECIDED_KEY, 'true')
    }

    await fixupRenamedSubcategories()
    await ensureSiniestrosCategory()
    await ensureRecurringTransactionsForCurrentMonth()
    setPhase(await nextPhaseAfterDatabaseReady())
  }

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      const session = data.session
      if (session?.user) prepareForUser(session.user.id, session.user.email ?? null)
      else setPhase('signedOut')
    })

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setEmail(null)
        setPhase('signedOut')
      } else if (event === 'SIGNED_IN' && session?.user) {
        prepareForUser(session.user.id, session.user.email ?? null)
      }
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync runs whenever the real app is actually up — right away on unlock, then
  // again periodically and whenever the device comes back online — regardless of
  // which path (fresh PIN setup, PIN unlock, or a just-finished claim/onboarding)
  // got the phase to "unlocked". Torn down the moment the phase leaves "unlocked"
  // (locking, signing out), so nothing runs against a database that's about to be
  // switched out from under it.
  useEffect(() => {
    if (phase !== 'unlocked') return

    const run = () => {
      syncNow()
    }
    run()
    const interval = setInterval(run, 90_000)
    window.addEventListener('online', run)

    return () => {
      clearInterval(interval)
      window.removeEventListener('online', run)
    }
  }, [phase])

  async function sendMagicLink(emailInput: string) {
    const { error } = await supabase.auth.signInWithOtp({
      email: emailInput,
      options: { emailRedirectTo: window.location.origin },
    })
    return { error: error?.message ?? null }
  }

  async function claim(choice: 'claim' | 'fresh') {
    if (choice === 'claim') {
      await claimLegacyData()
      // Real history was just claimed — including any recurring rules it already
      // had — so skip asking a returning user to "set up their salary" from zero.
      await db.userSettings.update('default', { recurringOnboardingDone: true })
    } else {
      await seedIfEmpty()
    }
    localStorage.setItem(CLAIM_DECIDED_KEY, 'true')
    await fixupRenamedSubcategories()
    await ensureSiniestrosCategory()
    await ensureRecurringTransactionsForCurrentMonth()
    setPhase(await nextPhaseAfterDatabaseReady())
  }

  async function setupPin(pin: string) {
    const pinHash = await hashPin(pin)
    await db.userSettings.update('default', { pinHash })
    const settings = await db.userSettings.get('default')
    setPhase(settings?.recurringOnboardingDone ? 'unlocked' : 'needsRecurringOnboarding')
  }

  async function unlock(pin: string) {
    const settings = await db.userSettings.get('default')
    if (!settings?.pinHash) return false
    const attemptHash = await hashPin(pin)
    if (attemptHash !== settings.pinHash) return false
    setPhase('unlocked')
    return true
  }

  async function finishRecurringOnboarding() {
    await db.userSettings.update('default', { recurringOnboardingDone: true })
    setPhase('unlocked')
  }

  async function signOut() {
    await supabase.auth.signOut()
    // onAuthStateChange's SIGNED_OUT branch above resets phase/email — the local
    // database itself is left untouched so logging back in as the same person
    // doesn't need to re-seed or re-sync from scratch.
  }

  return (
    <AuthContext.Provider value={{ phase, email, sendMagicLink, claim, setupPin, unlock, finishRecurringOnboarding, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
