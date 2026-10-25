import { MotionConfig } from 'motion/react'
import { useEffect, useState } from 'react'
import { Auth, Onboarding } from './Auth'
import Landing from './Landing'
import { IntakeSheet } from './IntakeSheet'
import { JobSheet } from './JobSheet'
import { Board, Customers, Messages, SettingsPage } from './pages'
import { connect, dismissNotice, useStore } from './store'
import { supabase, useSession } from './supabase'
import { InstallBanner } from './Install'
import { useOnline } from './pwa'
import { Icon, Sheet } from './ui'

type Tab = 'board' | 'customers' | 'messages' | 'settings'
const TABS: { id: Tab; label: string; icon: 'board' | 'people' | 'chat' | 'gear' }[] = [
  { id: 'board', label: 'Workshop', icon: 'board' },
  { id: 'customers', label: 'Customers', icon: 'people' },
  { id: 'messages', label: 'Messages', icon: 'chat' },
  { id: 'settings', label: 'Settings', icon: 'gear' },
]

export default function App() {
  const session = useSession()
  const { phase } = useStore()

  useEffect(() => (session ? connect() : undefined), [session?.user.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (session === undefined) return <div className="auth" aria-busy="true" />
  if (supabase && !session) return <Entry />
  if (supabase && phase === 'loading') return <div className="auth" aria-busy="true"><span className="logo big pulse">C</span></div>
  if (supabase && phase === 'no-store')
    return <Onboarding suggested={String(session?.user.user_metadata?.shop ?? '')} />
  return <Shell />
}

const isInstalled = () =>
  matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true

/** Signed out: marketing page for visitors, straight to sign-in inside the installed app. */
function Entry() {
  const [hash, setHash] = useState(location.hash)
  useEffect(() => {
    const on = () => setHash(location.hash)
    addEventListener('hashchange', on)
    return () => removeEventListener('hashchange', on)
  }, [])
  const view = hash === '#signup' ? 'up' : hash === '#signin' ? 'in' : isInstalled() ? 'in' : null
  useEffect(() => {
    if (view) window.scrollTo(0, 0)
  }, [view])
  if (!view) return <Landing />
  return <Auth initial={view} onBack={isInstalled() ? undefined : () => { location.hash = '' }} />
}

function Shell() {
  const [tab, setTab] = useState<Tab>('board')
  const [jobId, setJobId] = useState<string | null>(null)
  const [intake, setIntake] = useState(() => new URLSearchParams(location.search).has('new'))
  const { settings, notice } = useStore()
  const online = useOnline()

  // Opened from the "New check-in" home-screen shortcut (/?new=1): clean the address bar.
  useEffect(() => {
    if (location.search) history.replaceState(null, '', location.pathname)
  }, [])

  const sheet = intake ? 'intake' : jobId ? 'job' : null

  return (
    <MotionConfig reducedMotion="user">
      <div className="app">
        <nav className="nav" aria-label="Main">
          <div className="brand"><span className="logo">C</span><b>{settings.storeName}</b></div>
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)} aria-current={tab === t.id ? 'page' : undefined}>
              <Icon name={t.icon} /><span>{t.label}</span>
            </button>
          ))}
          <button className="btn primary new-btn" onClick={() => setIntake(true)}>
            <Icon name="plus" /><span>New check-in</span>
          </button>
          {supabase && (
            <button className="signout" onClick={() => supabase?.auth.signOut()}>Sign out</button>
          )}
        </nav>

        <main>
          {!online && <p className="offline" role="status">You’re offline. Changes can’t be saved until you reconnect.</p>}
          <InstallBanner />
          {tab === 'board' && <Board onOpen={setJobId} />}
          {tab === 'customers' && <Customers onOpen={setJobId} />}
          {tab === 'messages' && <Messages />}
          {tab === 'settings' && <SettingsPage />}
        </main>

        {notice && (
          <div className="toast" role="alert">
            <span>{notice}</span>
            <button onClick={dismissNotice} aria-label="Dismiss">Dismiss</button>
          </div>
        )}

        {(tab === 'board' || tab === 'customers') && (
          <button className="fab" onClick={() => setIntake(true)} aria-label="New check-in"><Icon name="plus" /></button>
        )}

        <Sheet
          open={sheet !== null}
          label={sheet === 'intake' ? 'New check-in' : 'Job details'}
          onClose={() => (setIntake(false), setJobId(null))}
        >
          {sheet === 'intake' && (
            <IntakeSheet
              onClose={() => setIntake(false)}
              onDone={(id) => { setIntake(false); setTab('board'); setJobId(id) }}
            />
          )}
          {sheet === 'job' && jobId && <JobSheet jobId={jobId} onClose={() => setJobId(null)} />}
        </Sheet>
      </div>
    </MotionConfig>
  )
}
