import { MotionConfig } from 'motion/react'
import { useState } from 'react'
import { IntakeSheet } from './IntakeSheet'
import { JobSheet } from './JobSheet'
import { Board, Customers, Messages, SettingsPage } from './pages'
import { useStore } from './store'
import { Icon, Sheet } from './ui'

type Tab = 'board' | 'customers' | 'messages' | 'settings'
const TABS: { id: Tab; label: string; icon: 'board' | 'people' | 'chat' | 'gear' }[] = [
  { id: 'board', label: 'Workshop', icon: 'board' },
  { id: 'customers', label: 'Customers', icon: 'people' },
  { id: 'messages', label: 'Messages', icon: 'chat' },
  { id: 'settings', label: 'Settings', icon: 'gear' },
]

export default function App() {
  const [tab, setTab] = useState<Tab>('board')
  const [jobId, setJobId] = useState<string | null>(null)
  const [intake, setIntake] = useState(false)
  const { settings } = useStore()

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
        </nav>

        <main>
          {tab === 'board' && <Board onOpen={setJobId} />}
          {tab === 'customers' && <Customers onOpen={setJobId} />}
          {tab === 'messages' && <Messages />}
          {tab === 'settings' && <SettingsPage />}
        </main>

        <button className="fab" onClick={() => setIntake(true)} aria-label="New check-in"><Icon name="plus" /></button>

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
