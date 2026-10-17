export type Status = 'new' | 'in_progress' | 'complete' | 'ready' | 'closed'

export const STATUSES: { id: Status; label: string }[] = [
  { id: 'new', label: 'New' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'complete', label: 'Complete' },
  { id: 'ready', label: 'Ready for Pickup' },
  { id: 'closed', label: 'Closed' },
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
  status: Status
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
}

export interface Employee {
  id: string
  name: string
}

export interface Settings {
  storeName: string
  readyMessage: string
  closedMessage: string
  reviewLink: string
  employees: Employee[]
}

export interface State {
  customers: Customer[]
  jobs: Job[]
  messages: Message[]
  settings: Settings
}
