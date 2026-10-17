import { useSyncExternalStore } from 'react'
import { buildMessages } from './notify'
import { supabase } from './supabase'
import type { Customer, Employee, Job, JobEvent, Message, Settings, State, Status } from './types'
import { STATUSES } from './types'

const KEY = 'counter.v1'
const id = () => crypto.randomUUID()
const ago = (mins: number) => new Date(Date.now() - mins * 60_000).toISOString()
const remote = supabase

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
  if (remote) return { customers: [], jobs: [], messages: [], settings: defaultSettings, phase: 'loading' }
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
  if (!remote) {
    try {
      localStorage.setItem(KEY, JSON.stringify(state))
    } catch {
      // storage full (large photos): keep working in memory
    }
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

/** Store phones in one shape so the same person always matches: +1XXXXXXXXXX for 10/11-digit numbers. */
function cleanPhone(raw: string) {
  const d = norm(raw)
  if (!d) return ''
  if (raw.trim().startsWith('+')) return `+${d}`
  if (d.length === 10) return `+1${d}`
  if (d.length === 11 && d.startsWith('1')) return `+${d}`
  return raw.trim()
}

function patchJob(jobId: string, fn: (j: Job) => Job) {
  commit({
    ...state,
    jobs: state.jobs.map((j) =>
      j.id === jobId ? { ...fn(j), updatedAt: new Date().toISOString() } : j,
    ),
  })
}

/* ───────────────────────── remote sync ───────────────────────── */

let storeId: string | null = null
const photoUrls = new Map<string, string>() // storage path -> usable URL

function fail(e: unknown) {
  const msg = e instanceof Error ? e.message : (e as { message?: string })?.message ?? 'Something went wrong'
  commit({ ...state, notice: msg })
  void refresh()
}

export function dismissNotice() {
  commit({ ...state, notice: undefined })
}

async function must<T>(q: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await q
  if (error) throw error
  return data
}

const list = async <T,>(q: PromiseLike<{ data: T[] | null; error: { message: string } | null }>) => (await must(q)) ?? []

export async function refresh() {
  if (!remote) return
  try {
    const [st, members, customers, jobs, events, messages] = await Promise.all([
      must(remote.from('stores').select('*').maybeSingle()),
      list(remote.from('members').select('id,name,user_id').order('name')),
      list(remote.from('customers').select('*').order('created_at', { ascending: false })),
      list(remote.from('jobs').select('*').order('intake_at', { ascending: false })),
      list(remote.from('job_events').select('job_id,text,at').order('at')),
      list(remote.from('messages').select('*').order('at', { ascending: false })),
    ])
    if (!st) {
      storeId = null
      commit({ ...state, phase: 'no-store' })
      return
    }
    storeId = st.id

    const missing = jobs.filter((j) => j.photo_path && !photoUrls.has(j.photo_path)).map((j) => j.photo_path as string)
    if (missing.length) {
      const { data } = await remote.storage.from('job-photos').createSignedUrls(missing, 60 * 60 * 6)
      data?.forEach((d) => d.path && d.signedUrl && photoUrls.set(d.path, d.signedUrl))
    }

    const evByJob = new Map<string, JobEvent[]>()
    events.forEach((e) => evByJob.set(e.job_id, [...(evByJob.get(e.job_id) ?? []), { at: e.at, text: e.text }]))

    const next: State = {
      phase: 'ready',
      notice: state.notice,
      settings: {
        storeName: st.name,
        readyMessage: st.ready_message,
        closedMessage: st.closed_message,
        reviewLink: st.review_link,
        employees: members.map((m): Employee => ({ id: m.id, name: m.name, isLogin: !!m.user_id })),
      },
      customers: customers.map((c): Customer => ({
        id: c.id, name: c.name, email: c.email ?? '', phone: c.phone ?? '', createdAt: c.created_at,
      })),
      jobs: jobs.map((j): Job => ({
        id: j.id, customerId: j.customer_id, item: j.item, notes: j.notes,
        photo: j.photo_path ? photoUrls.get(j.photo_path) : undefined,
        status: j.status, assigneeId: j.assignee_id ?? undefined, notify: j.notify,
        intakeAt: j.intake_at, updatedAt: j.updated_at, events: evByJob.get(j.id) ?? [],
      })),
      messages: messages.map((m): Message => ({
        id: m.id, jobId: m.job_id, customerId: m.customer_id, channel: m.channel, kind: m.kind,
        to: m.to_address, subject: m.subject ?? undefined, body: m.body, at: m.at,
        status: m.status, error: m.error ?? undefined,
      })),
    }
    // A pending local settings edit wins until it has been saved.
    commit(settingsTimer ? { ...next, settings: { ...next.settings, ...pendingSettings } } : next)
  } catch (e) {
    commit({ ...state, notice: (e as { message?: string }).message ?? 'Could not reach the server' })
  }
}

/** Start syncing. Returns a stop function. Call once a user is signed in. */
export function connect() {
  if (!remote) return () => {}
  commit({ ...state, phase: 'loading' })
  void refresh()
  const poll = setInterval(() => document.visibilityState === 'visible' && void refresh(), 15_000)
  const onFocus = () => void refresh()
  addEventListener('focus', onFocus)
  return () => {
    clearInterval(poll)
    removeEventListener('focus', onFocus)
    storeId = null
    photoUrls.clear()
    commit({ customers: [], jobs: [], messages: [], settings: defaultSettings, phase: 'loading' })
  }
}

export async function createShop(name: string) {
  if (!remote) return
  try {
    await must(remote.rpc('create_store', { p_name: name }))
    await refresh()
  } catch (e) {
    fail(e)
  }
}

/** Delivery runs in the background after a status change, so check back a couple of times. */
function followUp() {
  setTimeout(() => void refresh(), 2500)
  setTimeout(() => void refresh(), 8000)
}

/* ───────────────────────── actions ───────────────────────── */

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
  const phone = cleanPhone(input.phone)
  const existing = state.customers.find(
    (c) => (email && c.email.toLowerCase() === email) || (phone && norm(c.phone) === norm(phone)),
  )
  const now = new Date().toISOString()
  const customer: Customer = existing ?? { id: id(), name: input.name.trim(), email, phone, createdAt: now }
  const job: Job = {
    id: id(), customerId: customer.id, item: input.item.trim(), notes: input.notes.trim(),
    photo: input.photo, status: 'new', assigneeId: input.assigneeId, notify: input.notify,
    intakeAt: now, updatedAt: now, events: [{ at: now, text: 'Checked in' }],
  }
  commit({
    ...state,
    customers: existing ? state.customers : [customer, ...state.customers],
    jobs: [job, ...state.jobs],
  })

  if (remote && storeId) {
    const sid = storeId
    void (async () => {
      if (!existing)
        await must(remote.from('customers').insert({
          id: customer.id, store_id: sid, name: customer.name, email: email || null, phone: phone || null,
        }))
      let photo_path: string | null = null
      if (input.photo) {
        photo_path = `${sid}/${job.id}.jpg`
        const blob = await (await fetch(input.photo)).blob()
        const { error } = await remote.storage.from('job-photos').upload(photo_path, blob, { contentType: 'image/jpeg' })
        if (error) throw error
        photoUrls.set(photo_path, input.photo)
      }
      await must(remote.from('jobs').insert({
        id: job.id, store_id: sid, customer_id: customer.id, item: job.item, notes: job.notes,
        photo_path, assignee_id: job.assigneeId ?? null, notify: job.notify,
      }))
      await must(remote.from('job_events').insert({ job_id: job.id, text: 'Checked in' }))
      await refresh()
    })().catch(fail)
  }
  return job
}

export function setStatus(jobId: string, status: Status) {
  const job = state.jobs.find((j) => j.id === jobId)
  if (!job || job.status === status) return
  patchJob(jobId, (j) => ({
    ...j, status, events: [...j.events, event(`Moved to ${label(status)}`)],
  }))

  if (remote) {
    // The database queues the customer message when the status changes; the Edge Function delivers it.
    void (async () => {
      await must(remote.from('jobs').update({ status }).eq('id', jobId))
      await must(remote.from('job_events').insert({ job_id: jobId, text: `Moved to ${label(status)}` }))
      await refresh()
      followUp()
    })().catch(fail)
    return
  }

  const kind = status === 'ready' ? 'ready' : status === 'closed' ? 'closed' : null
  if (!kind || !job.notify) return
  // Don't re-text a customer if a job bounces back and forth. Use "Resend" instead.
  if (state.messages.some((m) => m.jobId === jobId && m.kind === kind)) return
  sendMessages(jobId, kind)
}

export function sendMessages(jobId: string, kind: 'ready' | 'closed') {
  if (remote) {
    void must(remote.rpc('resend_message', { p_job: jobId, p_kind: kind }))
      .then(() => remote.from('job_events').insert({
        job_id: jobId, text: `${kind === 'ready' ? 'Pickup' : 'Thank-you'} message sent again`,
      }))
      .then(refresh)
      .then(followUp)
      .catch(fail)
    return
  }
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

function logEvent(jobId: string, text: string) {
  return must(remote!.from('job_events').insert({ job_id: jobId, text }))
}

export function setAssignee(jobId: string, assigneeId?: string) {
  const name = state.settings.employees.find((e) => e.id === assigneeId)?.name
  const text = name ? `Assigned to ${name}` : 'Unassigned'
  patchJob(jobId, (j) => ({ ...j, assigneeId, events: [...j.events, event(text)] }))
  if (remote)
    void must(remote.from('jobs').update({ assignee_id: assigneeId ?? null, updated_at: new Date().toISOString() }).eq('id', jobId))
      .then(() => logEvent(jobId, text)).then(refresh).catch(fail)
}

export function setNotify(jobId: string, notify: boolean) {
  const text = notify ? 'Automatic messages on' : 'Automatic messages off'
  patchJob(jobId, (j) => ({ ...j, notify, events: [...j.events, event(text)] }))
  if (remote)
    void must(remote.from('jobs').update({ notify, updated_at: new Date().toISOString() }).eq('id', jobId))
      .then(() => logEvent(jobId, text)).then(refresh).catch(fail)
}

export function setNotes(jobId: string, notes: string) {
  patchJob(jobId, (j) => ({ ...j, notes }))
  if (remote)
    void must(remote.from('jobs').update({ notes, updated_at: new Date().toISOString() }).eq('id', jobId)).catch(fail)
}

let settingsTimer: ReturnType<typeof setTimeout> | undefined
let pendingSettings: Partial<Settings> = {}

export function updateSettings(patch: Partial<Omit<Settings, 'employees'>>) {
  commit({ ...state, settings: { ...state.settings, ...patch } })
  if (!remote || !storeId) return
  pendingSettings = { ...pendingSettings, ...patch }
  clearTimeout(settingsTimer)
  settingsTimer = setTimeout(() => {
    const p = pendingSettings
    pendingSettings = {}
    settingsTimer = undefined
    void must(remote.from('stores').update({
      ...(p.storeName !== undefined && { name: p.storeName.trim() || 'My Shop' }),
      ...(p.readyMessage !== undefined && { ready_message: p.readyMessage }),
      ...(p.closedMessage !== undefined && { closed_message: p.closedMessage }),
      ...(p.reviewLink !== undefined && { review_link: p.reviewLink }),
    }).eq('id', storeId!)).catch(fail)
  }, 700)
}

export function addEmployee(name: string) {
  const emp: Employee = { id: id(), name }
  commit({ ...state, settings: { ...state.settings, employees: [...state.settings.employees, emp] } })
  if (remote && storeId)
    void must(remote.from('members').insert({ id: emp.id, store_id: storeId, name })).then(refresh).catch(fail)
}

export function removeEmployee(empId: string) {
  commit({
    ...state,
    settings: { ...state.settings, employees: state.settings.employees.filter((e) => e.id !== empId) },
    jobs: state.jobs.map((j) => (j.assigneeId === empId ? { ...j, assigneeId: undefined } : j)),
  })
  if (remote) void must(remote.from('members').delete().eq('id', empId)).then(refresh).catch(fail)
}

export function resetDemo() {
  if (!remote) commit(seed())
}
