import { useState } from 'react'
import { createShop } from './store'
import { supabase } from './supabase'
import { Field } from './ui'

export function Auth() {
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [shop, setShop] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok?: boolean }>()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setBusy(true)
    setMsg(undefined)
    if (mode === 'in') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setMsg({ text: error.message })
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { shop: shop.trim() } } })
      if (error) setMsg({ text: error.message })
      else if (!data.session) setMsg({ ok: true, text: 'Check your email to confirm your address, then sign in.' })
    }
    setBusy(false)
  }

  return (
    <div className="auth">
      <form className="auth-card" onSubmit={submit}>
        <span className="logo big">C</span>
        <h1>{mode === 'in' ? 'Welcome back' : 'Set up your shop'}</h1>
        <p>{mode === 'in' ? 'Sign in to Counter.' : 'Create a login for your shop. It takes a minute.'}</p>
        {mode === 'up' && (
          <Field label="Shop name">
            <input required value={shop} onChange={(e) => setShop(e.target.value)} placeholder="Spoke & Chain Cycles" autoComplete="organization" />
          </Field>
        )}
        <Field label="Email">
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </Field>
        <Field label="Password" hint={mode === 'up' ? 'At least 8 characters' : undefined}>
          <input required type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} />
        </Field>
        {msg && <p className={msg.ok ? 'note-ok' : 'form-err'} role="status">{msg.text}</p>}
        <button className="btn primary wide" disabled={busy}>{busy ? 'One moment…' : mode === 'in' ? 'Sign in' : 'Create account'}</button>
        <button type="button" className="link" onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setMsg(undefined) }}>
          {mode === 'in' ? 'New shop? Create an account' : 'Already have an account? Sign in'}
        </button>
      </form>
    </div>
  )
}

/** Signed in, but no shop yet (the first sign-in after sign-up). */
export function Onboarding({ suggested }: { suggested: string }) {
  const [name, setName] = useState(suggested)
  const [busy, setBusy] = useState(false)
  return (
    <div className="auth">
      <form
        className="auth-card"
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          await createShop(name)
          setBusy(false)
        }}
      >
        <span className="logo big">C</span>
        <h1>Name your shop</h1>
        <p>This appears in the messages your customers receive.</p>
        <Field label="Shop name">
          <input autoFocus required value={name} onChange={(e) => setName(e.target.value)} placeholder="Spoke & Chain Cycles" />
        </Field>
        <button className="btn primary wide" disabled={busy || !name.trim()}>{busy ? 'Creating…' : 'Continue'}</button>
      </form>
    </div>
  )
}
