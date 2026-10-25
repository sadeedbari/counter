import { AnimatePresence, motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { VARIABLES, render } from './notify'
import { addEmployee, removeEmployee, resetDemo, setStatus, updateSettings, useStore } from './store'
import { supabase, useSession } from './supabase'
import { InstallCard } from './Install'
import { Workflow } from './Workflow'
import type { Job } from './types'
import { Avatar, Icon, StatusPill, exact, phaseColor, useWide, when } from './ui'

const lastVisit = (js: Job[]) => js.reduce((a, j) => (j.intakeAt > a ? j.intakeAt : a), js[0].intakeAt)

const spring = { type: 'spring', bounce: 0, duration: 0.4 } as const

/* ───────────────────────── Board ───────────────────────── */

export function Board({ onOpen }: { onOpen: (id: string) => void }) {
  const { jobs, customers, settings } = useStore()
  const { phases } = settings
  const wide = useWide()
  const [q, setQ] = useState('')
  const [who, setWho] = useState('')
  const [showAllClosed, setShowAllClosed] = useState(false)
  const [tab, setTab] = useState(phases[0]?.id)

  const cust = (id: string) => customers.find((c) => c.id === id)!
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return jobs.filter((j) => {
      if (who && (who === 'none' ? j.assigneeId : j.assigneeId !== who)) return false
      if (!needle) return true
      const c = cust(j.customerId)
      return [c.name, c.email, c.phone, j.item].some((t) => t.toLowerCase().includes(needle))
    })
  }, [jobs, customers, q, who]) // eslint-disable-line react-hooks/exhaustive-deps

  const closedIds = new Set(phases.filter((p) => p.kind === 'closed').map((p) => p.id))
  const openCount = jobs.filter((j) => !closedIds.has(j.status)).length
  const shown = wide ? phases : phases.filter((p) => p.id === (phases.some((x) => x.id === tab) ? tab : phases[0].id))

  return (
    <>
      <PageHead title="Workshop" sub={`${openCount} open ${openCount === 1 ? 'job' : 'jobs'}`}>
        <Search value={q} onChange={setQ} placeholder="Search name, item, phone" />
        <select className="select-pill" value={who} onChange={(e) => setWho(e.target.value)} aria-label="Filter by employee">
          <option value="">Everyone</option>
          <option value="none">Unassigned</option>
          {settings.employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
      </PageHead>

      {!wide && (
        <div className="phase-tabs" role="tablist" aria-label="Phase">
          {phases.map((p) => {
            const n = filtered.filter((j) => j.status === p.id).length
            const on = p.id === (phases.some((x) => x.id === tab) ? tab : phases[0].id)
            return (
              <button key={p.id} role="tab" aria-selected={on} className={on ? 'on' : ''} style={phaseColor(p.color)} onClick={() => setTab(p.id)}>
                <i /> {p.name} <span>{n}</span>
              </button>
            )
          })}
        </div>
      )}

      <div className="board">
        {shown.map((s) => {
          const all = filtered.filter((j) => j.status === s.id).sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
          const capped = s.kind === 'closed' && !showAllClosed
          const items = capped ? all.slice(0, 5) : all
          return (
            <section key={s.id} className="col" aria-label={s.name}>
              {wide && (
                <h2 className="col-head" style={phaseColor(s.color)}>
                  <i /> {s.name} <span>{all.length}</span>
                </h2>
              )}
              <div className="col-list">
                <AnimatePresence initial={false} mode="popLayout">
                  {items.map((j) => (
                    <JobCard key={j.id} job={j} onOpen={onOpen} />
                  ))}
                </AnimatePresence>
                {all.length === 0 && <p className="empty-col">Nothing here</p>}
                {s.kind === 'closed' && all.length > 5 && (
                  <button className="link" onClick={() => setShowAllClosed((v) => !v)}>
                    {showAllClosed ? 'Show fewer' : `Show all ${all.length}`}
                  </button>
                )}
              </div>
            </section>
          )
        })}
      </div>
    </>
  )
}

function JobCard({ job, onOpen }: { job: Job; onOpen: (id: string) => void }) {
  const { customers, settings } = useStore()
  const c = customers.find((x) => x.id === job.customerId)!
  const idx = settings.phases.findIndex((s) => s.id === job.status)
  const next = settings.phases[idx + 1]
  const who = settings.employees.find((e) => e.id === job.assigneeId)

  return (
    <motion.article
      layout="position"
      initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
      transition={spring}
      whileTap={{ scale: 0.98 }}
      className="job-card" tabIndex={0} role="button"
      onClick={() => onOpen(job.id)}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onOpen(job.id))}
    >
      <div className="job-top">
        {job.photo ? <img src={job.photo} alt="" className="job-thumb" /> : <Avatar name={c.name} />}
        <div className="job-main">
          <h3>{c.name}</h3>
          <p>{job.item}</p>
        </div>
      </div>
      <div className="job-meta">
        <span>{who ? who.name : 'Unassigned'}</span>
        <span>·</span>
        <span>{when(job.intakeAt)}</span>
        {!job.notify && <span className="muted-tag" title="Automatic messages are off">Messages off</span>}
      </div>
      {next && (
        <button
          className="advance"
          onClick={(e) => { e.stopPropagation(); setStatus(job.id, next.id) }}
        >
          {next.name} <Icon name="chev" />
        </button>
      )}
    </motion.article>
  )
}

/* ───────────────────────── Customers ───────────────────────── */

export function Customers({ onOpen }: { onOpen: (id: string) => void }) {
  const { customers, jobs, settings } = useStore()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const [onlyOpen, setOnlyOpen] = useState(false)

  const closedSet = useMemo(() => new Set(settings.phases.filter((p) => p.kind === 'closed').map((p) => p.id)), [settings.phases])
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return customers
      .map((c) => ({ c, js: jobs.filter((j) => j.customerId === c.id) }))
      .filter(({ c, js }) => {
        if (onlyOpen && !js.some((j) => !closedSet.has(j.status))) return false
        if (!needle) return true
        return [c.name, c.email, c.phone, ...js.map((j) => j.item)].some((t) => t.toLowerCase().includes(needle))
      })
      .sort((a, b) => +new Date(b.js[0]?.intakeAt ?? b.c.createdAt) - +new Date(a.js[0]?.intakeAt ?? a.c.createdAt))
  }, [customers, jobs, q, onlyOpen, closedSet])

  return (
    <>
      <PageHead title="Customers" sub={`${customers.length} in your book`}>
        <Search value={q} onChange={setQ} placeholder="Search name, email, phone, item" />
        <button className={`chip ${onlyOpen ? 'on' : ''}`} onClick={() => setOnlyOpen((v) => !v)} aria-pressed={onlyOpen}>
          Has open job
        </button>
      </PageHead>

      <div className="list-card">
        {rows.length === 0 && <p className="empty-col pad">No customers match.</p>}
        {rows.map(({ c, js }) => (
          <div key={c.id} className="cust">
            <button className="cust-row" onClick={() => setOpen(open === c.id ? null : c.id)} aria-expanded={open === c.id}>
              <Avatar name={c.name} />
              <div className="cust-main">
                <b>{c.name}</b>
                <span>{[c.phone, c.email].filter(Boolean).join('  ·  ')}</span>
                <span className="cust-visit">
                  {js.length ? `Last visit ${exact(lastVisit(js))}` : 'No visits yet'}
                </span>
              </div>
              <span className="count">{js.length} {js.length === 1 ? 'visit' : 'visits'}</span>
              <motion.span animate={{ rotate: open === c.id ? 90 : 0 }} transition={spring} className="chev"><Icon name="chev" /></motion.span>
            </button>
            <AnimatePresence initial={false}>
              {open === c.id && (
                <motion.ul
                  className="cust-jobs"
                  initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  transition={spring}
                >
                  <li className="cust-since">Customer since {exact(c.createdAt)}</li>
                  {js.map((j) => (
                    <li key={j.id}>
                      <button onClick={() => onOpen(j.id)}>
                        <span>{j.item}<small>Checked in {exact(j.intakeAt)}</small></span>
                        <StatusPill status={j.status} />
                      </button>
                    </li>
                  ))}
                </motion.ul>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </>
  )
}

/* ───────────────────────── Messages ───────────────────────── */

export function Messages() {
  const { messages, customers } = useStore()
  return (
    <>
      <PageHead title="Messages" sub="Everything sent to customers" />
      {!supabase && (
        <p className="banner">
          Demo mode: messages are recorded here instead of being delivered. Connect Resend (email) and Twilio (text) to send them for real.
        </p>
      )}
      <div className="list-card">
        {messages.length === 0 && <p className="empty-col pad">Nothing sent yet. Move a job to Ready for Pickup to see one.</p>}
        {messages.map((m) => (
          <div key={m.id} className="msg">
            <span className={`msg-ico ${m.channel}`}><Icon name={m.channel === 'sms' ? 'sms' : 'mail'} /></span>
            <div>
              <b>{customers.find((c) => c.id === m.customerId)?.name} <small>{m.to}</small> <DeliveryTag m={m} /></b>
              {m.subject && <em>{m.subject}</em>}
              <p>{m.body}</p>
              {m.status === 'failed' && m.error && <p className="fail-note">{m.error}</p>}
            </div>
            <time>{when(m.at)}</time>
          </div>
        ))}
      </div>
    </>
  )
}

/* ───────────────────────── Settings ───────────────────────── */

export function SettingsPage() {
  const { settings: s, jobs, customers } = useStore()
  const session = useSession()
  const [name, setName] = useState('')
  const sampleJob = jobs[0]
  const sampleCust = sampleJob && customers.find((c) => c.id === sampleJob.customerId)

  return (
    <>
      <PageHead title="Settings" sub={s.storeName} />
      <div className="settings">
        <InstallCard />
        <section className="card">
          <h3>Store</h3>
          <label className="field"><span>Store name</span>
            <input value={s.storeName} onChange={(e) => updateSettings({ storeName: e.target.value })} />
          </label>
          <label className="field"><span>Google review link</span>
            <input value={s.reviewLink} onChange={(e) => updateSettings({ reviewLink: e.target.value })} placeholder="https://g.page/r/…" />
            <em>Included in the thank-you message when a job is closed.</em>
          </label>
        </section>

        <section className="card">
          <h3>Ready for pickup message</h3>
          <textarea rows={4} value={s.readyMessage} onChange={(e) => updateSettings({ readyMessage: e.target.value })} />
          <Preview text={s.readyMessage} job={sampleJob} cust={sampleCust} />
        </section>

        <section className="card">
          <h3>Thank-you message</h3>
          <textarea rows={4} value={s.closedMessage} onChange={(e) => updateSettings({ closedMessage: e.target.value })} />
          <Preview text={s.closedMessage} job={sampleJob} cust={sampleCust} />
          <p className="vars">You can use {VARIABLES.map((v) => <code key={v}>{v}</code>)}</p>
        </section>

        <Workflow />

        <section className="card">
          <h3>Team</h3>
          <ul className="team">
            {s.employees.map((e) => (
              <li key={e.id}>
                <Avatar name={e.name} /> <span>{e.name}</span>
                {e.isLogin ? <small className="you">Signed-in user</small> : <button className="link danger" onClick={() => removeEmployee(e.id)}>Remove</button>}
              </li>
            ))}
          </ul>
          <form
            className="add-row"
            onSubmit={(ev) => {
              ev.preventDefault()
              if (!name.trim()) return
              addEmployee(name.trim())
              setName('')
            }}
          >
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Add a team member" />
            <button className="btn" type="submit">Add</button>
          </form>
        </section>

        {supabase && (
          <section className="card">
            <h3>Account</h3>
            {session?.user.email && <p className="muted">Signed in as {session.user.email}</p>}
            <button className="btn" onClick={() => supabase?.auth.signOut()}>Sign out</button>
          </section>
        )}

        {!supabase && <button className="link danger reset" onClick={() => confirm('Reset all demo data?') && resetDemo()}>Reset demo data</button>}
      </div>
    </>
  )
}

function Preview({ text, job, cust }: { text: string; job?: Job; cust?: { name: string; email: string; phone: string; id: string; createdAt: string } }) {
  const { settings } = useStore()
  if (!job || !cust) return null
  return <div className="bubble" aria-label="Preview">{render(text, job, cust, settings)}</div>
}

/* ───────────────────────── Shared bits ───────────────────────── */

function PageHead({ title, sub, children }: { title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <header className="page-head">
      <div>
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      <div className="tools">{children}</div>
    </header>
  )
}

function Search({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="search">
      <Icon name="search" />
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
    </label>
  )
}

export function DeliveryTag({ m }: { m: { status?: string } }) {
  if (!m.status) return null
  const text = { queued: 'Queued', sending: 'Sending', sent: 'Delivered', failed: 'Failed' }[m.status] ?? m.status
  return <span className={`dtag d-${m.status}`}>{text}</span>
}
