import { createClient } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

/** null means demo mode: no backend, data stays in this browser. */
export const supabase = url && key ? createClient(url, key) : null

/** undefined = still checking, null = signed out. */
export function useSession() {
  const [session, setSession] = useState<{ user: { id: string; email?: string; user_metadata: Record<string, unknown> } } | null | undefined>(
    supabase ? undefined : null,
  )
  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])
  return session
}
