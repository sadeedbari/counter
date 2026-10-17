import type { Customer, Job, Message, Settings } from './types'

export const VARIABLES = ['{{name}}', '{{item}}', '{{store}}', '{{review_link}}']

export function render(template: string, job: Job, customer: Customer, s: Settings) {
  return template
    .replaceAll('{{name}}', customer.name.split(' ')[0] || customer.name)
    .replaceAll('{{item}}', job.item)
    .replaceAll('{{store}}', s.storeName)
    .replaceAll('{{review_link}}', s.reviewLink)
}

/**
 * Builds the outbound messages for a status change. In this prototype they are
 * written to the outbox. In production the same objects are handed to an Edge
 * Function that calls Resend (email) and Twilio (SMS).
 */
export function buildMessages(
  kind: 'ready' | 'closed',
  job: Job,
  customer: Customer,
  s: Settings,
): Message[] {
  const body = render(kind === 'ready' ? s.readyMessage : s.closedMessage, job, customer, s)
  const subject =
    kind === 'ready' ? `Your ${job.item} is ready for pickup` : `Thank you from ${s.storeName}`
  const base = { jobId: job.id, customerId: customer.id, kind, body, at: new Date().toISOString() }
  const out: Message[] = []
  if (customer.email)
    out.push({ ...base, id: crypto.randomUUID(), channel: 'email', to: customer.email, subject })
  if (customer.phone)
    out.push({ ...base, id: crypto.randomUUID(), channel: 'sms', to: customer.phone })
  return out
}
