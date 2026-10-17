import { useState } from 'react'
import { useInstall } from './pwa'
import { useWide } from './ui'

const KEY = 'counter.install-dismissed'
const dismissed = () => {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

function IosSteps() {
  return (
    <ol className="steps">
      <li>Tap the <b>Share</b> button in Safari’s toolbar.</li>
      <li>Choose <b>Add to Home Screen</b>.</li>
      <li>Tap <b>Add</b>. Counter opens like an app.</li>
    </ol>
  )
}

/** Settings: always available while the app isn't installed. */
export function InstallCard() {
  const { mode, install } = useInstall()
  if (mode === 'none') return null
  return (
    <section className="card">
      <div>
        <h3>Install Counter</h3>
        <p className="muted">Add it to your home screen or desktop to open it like an app, full screen.</p>
      </div>
      {mode === 'prompt' ? <button className="btn primary" onClick={install}>Install app</button> : <IosSteps />}
    </section>
  )
}

/** Phones and tablets: a one-time, dismissible nudge above the board. */
export function InstallBanner() {
  const { mode, install } = useInstall()
  const wide = useWide()
  const [hidden, setHidden] = useState(dismissed)
  if (mode === 'none' || wide || hidden) return null
  const close = () => {
    setHidden(true)
    try {
      localStorage.setItem(KEY, '1')
    } catch {}
  }
  return (
    <aside className="install-banner" aria-label="Install Counter">
      <span className="logo">C</span>
      <div>
        <b>Install Counter</b>
        {mode === 'ios' ? <p>Tap Share, then Add to Home Screen.</p> : <p>Open it from your home screen, full screen.</p>}
      </div>
      {mode === 'prompt' && <button className="btn primary" onClick={install}>Install</button>}
      <button className="icon-btn" onClick={close} aria-label="Dismiss">×</button>
    </aside>
  )
}
