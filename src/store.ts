import { useSyncExternalStore } from 'react'
import { buildMessages } from './notify'
import type { Customer, Job, JobEvent, Settings, State, Status } from './types'
import { STATUSES } from './types'

const KEY = 'counter.v1'
const id = () => crypto.randomUUID()
const ago = (mins: number) => new Date(Date.now() - mins * 60_000).toISOString()

const defaultSettings: Settings = {
  storeName: 'Spoke & Chain Cycles',
  readyMessage:
    'Hi {{name}}, your {{item}} is ready for pickup at {{store}}. We’re open Tue–Sat, 10–6. See you soon!',
  closedMessage:
    'Thanks for visiting {{store}}, {{name}}! If we did right by you, a quick review means the world to us: {{review_link}}',
  reviewLink: 'https://g.page/r/your-review-link',
  employees: [
    { id: 'e1', name: 'Maya' },
    { id: 'e2', name: 'Jordan' },
    { id: 'e3', name: 'Sam' },
  ],
}

function seed(): State {
  const c = (name: string, email: string, phone: string, m: number): Customer => ({
    id: id(), name, email, phone, createdAt: ago(m),
  })
  const customers = [
    c('Priya Raman', 'priya@example.com', '+1 416 555 0134', 60 * 30),
    c('Daniel Okafor', 'daniel@example.com', '+1 647 555 0188', 60 * 8),
    c('Lena Fischer', '', '+1 905 555 0172', 60 * 3),
    c('Tom Whitaker', 'tom@example.com', '', 45),
  ]
  const j = (
    i: number, item: string, status: Status, assigneeId: string | undefined, m: number, notes = '',
  ): Job => ({
    id: id(), customerId: customers[i].id, item, notes, status, assigneeId, notify: true,
    intakeAt: ago(m), updatedAt: ago(Math.max(5, m / 3)),
    events: [{ at: ago(m), text: 'Checked in' }],
  })
  return {
    customers,
    jobs: [
      j(0, 'Trek Domane road bike', 'in_progress', 'e1', 60 * 30, 'Rear derailleur skipping. Check cable and hanger.'),
      j(1, 'Brompton folding bike', 'ready', 'e2', 60 * 8, 'Full tune-up.'),
      j(2, 'Specialized Rockhopper', 'new', undefined, 60 * 3, 'Flat front tire, brakes squeal.'),
      j(3, 'Cannondale commuter', 'complete', 'e3', 45, 'Chain replaced, wheel trued.'),
    ],
    messages: [],
    settings: defaultSettings,
  }
}

function load(): State {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as State
  } catch {}
  return seed()
}

let state: State = load()
const listeners = new Set<() => void>()

function commit(next: State) {
  state = next
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // storage full (large photos): keep working in memory
  }
  listeners.forEach((l) => l())
}

export function useStore(): State {
  return useSyncExternalStore(
    (cb) => (listeners.add(cb), () => listeners.delete(cb)),
    () => state,
  )
}

const event = (text: string): JobEvent => ({ at: new Date().toISOString(), text })
const label = (s: Status) => STATUSES.find((x) => x.id === s)!.label
const norm = (p: string) => p.replace(/\D/g, '')

function patchJob(jobId: string, fn: (j: Job) => Job) {
  commit({
    ...state,
    jobs: state.jobs.map((j) =>
      j.id === jobId ? { ...fn(j), updatedAt: new Date().toISOString() } : j,
    ),
  })
}

export interface IntakeInput {
  name: string
  email: string
  phone: string
  item: string
  notes: string
  photo?: string
  assigneeId?: string
  notify: boolean
}

export function createJob(input: IntakeInput): Job {
  const email = input.email.trim().toLowerCase()
  const phone = input.phone.trim()
  let customer = state.customers.find(
    (c) => (email && c.email.toLowerCase() === email) || (phone && norm(c.phone) === norm(phone)),
  )
  const customers = [...state.customers]
  if (!customer) {
    customer = { id: id(), name: input.name.trim(), email, phone, createdAt: new Date().toISOString() }
    customers.unshift(customer)
  }
  const now = new Date().toISOString()
  const job: Job = {
    id: id(), customerId: customer.id, item: input.item.trim(), notes: input.notes.trim(),
    photo: input.photo, status: 'new', assigneeId: input.assigneeId, notify: input.notify,
    intakeAt: now, updatedAt: now, events: [{ at: now, text: 'Checked in' }],
  }
  commit({ ...state, customers, jobs: [job, ...state.jobs] })
  return job
}

export function setStatus(jobId: string, status: Status) {
  const job = state.jobs.find((j) => j.id === jobId)
  if (!job || job.status === status) return
  patchJob(jobId, (j) => ({
    ...j, status, events: [...j.events, event(`Moved to ${label(status)}`)],
  }))
  const kind = status === 'ready' ? 'ready' : status === 'closed' ? 'closed' : null
  if (!kind || !job.notify) return
  // Don't re-text a customer if a job bounces back and forth. Use "Resend" instead.
  if (state.messages.some((m) => m.jobId === jobId && m.kind === kind)) return
  sendMessages(jobId, kind)
}

export function sendMessages(jobId: string, kind: 'ready' | 'closed') {
  const job = state.jobs.find((j) => j.id === jobId)
  const customer = job && state.customers.find((c) => c.id === job.customerId)
  if (!job || !customer) return
  const msgs = buildMessages(kind, job, customer, state.settings)
  if (!msgs.length) return
  const channels = msgs.map((m) => (m.channel === 'sms' ? 'text' : 'email')).join(' + ')
  commit({ ...state, messages: [...msgs, ...state.messages] })
  patchJob(jobId, (j) => ({
    ...j, events: [...j.events, event(`${kind === 'ready' ? 'Pickup' : 'Thank-you'} message sent (${channels})`)],
  }))
}

export function setAssignee(jobId: string, assigneeId?: string) {
  const name = state.settings.employees.find((e) => e.id === assigneeId)?.name
  patchJob(jobId, (j) => ({
    ...j, assigneeId, events: [...j.events, event(name ? `Assigned to ${name}` : 'Unassigned')],
  }))
}

export function setNotify(jobId: string, notify: boolean) {
  patchJob(jobId, (j) => ({
    ...j, notify, events: [...j.events, event(notify ? 'Automatic messages on' : 'Automatic messages off')],
  }))
}

export function setNotes(jobId: string, notes: string) {
  patchJob(jobId, (j) => ({ ...j, notes }))
}

export function updateSettings(patch: Partial<Settings>) {
  commit({ ...state, settings: { ...state.settings, ...patch } })
}

export function resetDemo() {
  commit(seed())
}
