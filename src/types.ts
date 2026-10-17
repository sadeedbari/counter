export const PHASE_COLORS = ['blue', 'indigo', 'purple', 'pink', 'red', 'orange', 'yellow', 'green', 'teal', 'gray'] as const
export type PhaseColor = (typeof PHASE_COLORS)[number]

/** What happens when a job reaches the phase: nothing, the pickup message, or the thank-you (finished). */
export type PhaseKind = 'active' | 'ready' | 'closed'

export interface Phase {
  id: string
  name: string
  color: PhaseColor
  kind: PhaseKind
}

export const DEFAULT_PHASES: Phase[] = [
  { id: 'new', name: 'New', color: 'blue', kind: 'active' },
  { id: 'in_progress', name: 'In Progress', color: 'orange', kind: 'active' },
  { id: 'complete', name: 'Complete', color: 'teal', kind: 'active' },
  { id: 'ready', name: 'Ready for Pickup', color: 'green', kind: 'ready' },
  { id: 'closed', name: 'Closed', color: 'gray', kind: 'closed' },
]

type PhaseDraft = Omit<Phase, 'id'>
export const TEMPLATES: { id: string; label: string; blurb: string; phases: PhaseDraft[] }[] = [
  {
    id: 'repair', label: 'Repair shop', blurb: '5 phases',
    phases: DEFAULT_PHASES.map(({ id: _id, ...p }) => p),
  },
  {
    id: 'quick', label: 'Quick service', blurb: '4 phases',
    phases: [
      { name: 'Checked In', color: 'blue', kind: 'active' },
      { name: 'In Progress', color: 'orange', kind: 'active' },
      { name: 'Ready for Pickup', color: 'green', kind: 'ready' },
      { name: 'Picked Up', color: 'gray', kind: 'closed' },
    ],
  },
  {
    id: 'quotes', label: 'Quotes and parts', blurb: '7 phases',
    phases: [
      { name: 'New', color: 'blue', kind: 'active' },
      { name: 'Awaiting Approval', color: 'purple', kind: 'active' },
      { name: 'Waiting on Parts', color: 'yellow', kind: 'active' },
      { name: 'In Progress', color: 'orange', kind: 'active' },
      { name: 'Complete', color: 'teal', kind: 'active' },
      { name: 'Ready for Pickup', color: 'green', kind: 'ready' },
      { name: 'Closed', color: 'gray', kind: 'closed' },
    ],
  },
]

export interface Customer {
  id: string
  name: string
  email: string
  phone: string
  createdAt: string
}

export interface JobEvent {
  at: string
  text: string
}

export interface Job {
  id: string
  customerId: string
  item: string
  notes: string
  photo?: string
  /** Id of the phase the job is in. */
  status: string
  assigneeId?: string
  notify: boolean
  intakeAt: string
  updatedAt: string
  events: JobEvent[]
}

export interface Message {
  id: string
  jobId: string
  customerId: string
  channel: 'email' | 'sms'
  kind: 'ready' | 'closed'
  to: string
  subject?: string
  body: string
  at: string
  /** Delivery state. Only present when connected to the backend. */
  status?: 'queued' | 'sending' | 'sent' | 'failed'
  error?: string
}

export interface Employee {
  id: string
  name: string
  /** A staff login. Can't be removed from the team list. */
  isLogin?: boolean
}

export interface Settings {
  storeName: string
  readyMessage: string
  closedMessage: string
  reviewLink: string
  employees: Employee[]
  phases: Phase[]
}

export interface State {
  customers: Customer[]
  jobs: Job[]
  messages: Message[]
  settings: Settings
  /** Backend connection state; absent in demo mode. */
  phase?: 'loading' | 'ready' | 'no-store'
  notice?: string
}
