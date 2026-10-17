import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { sendMessages, setAssignee, setNotes, setNotify, setStatus, useStore } from './store'
import { STATUSES } from './types'
import { DeliveryTag } from './pages'
import { Field, Icon, Switch, when } from './ui'

export function JobSheet({ jobId, onClose }: { jobId: string; onClose: () => void }) {
  const { jobs, customers, settings, messages } = useStore()
  const job = jobs.find((j) => j.id === jobId)
  const customer = job && customers.find((c) => c.id === job.customerId)
  const [notes, setLocalNotes] = useState(job?.notes ?? '')
  useEffect(() => setLocalNotes(job?.notes ?? ''), [jobId]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!job || !customer) return null

  const sent = messages.filter((m) => m.jobId === job.id)
  const resendKind = job.status === 'ready' ? 'ready' : job.status === 'closed' ? 'closed' : null

  return (
    <div className="sheet-body">
      <header className="sheet-head">
        <div>
          <h2>{customer.name}</h2>
          <p>{job.item}</p>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
      </header>

      <div className="stack">
        {job.photo && <img className="job-photo" src={job.photo} alt={job.item} />}

        <div className="segmented" role="radiogroup" aria-label="Status">
          {STATUSES.map((s) => (
            <button
              key={s.id} role="radio" aria-checked={job.status === s.id}
              className={job.status === s.id ? 'on' : ''}
              onClick={() => setStatus(job.id, s.id)}
            >
              {job.status === s.id && (
                <motion.i
                  layoutId="seg" className={`seg-thumb s-${s.id}`}
                  transition={{ type: 'spring', bounce: 0.1, duration: 0.4 }}
                />
              )}
              <span>{s.label}</span>
            </button>
          ))}
        </div>

        <Field label="Assigned to">
          <select value={job.assigneeId ?? ''} onChange={(e) => setAssignee(job.id, e.target.value || undefined)}>
            <option value="">Unassigned</option>
            {settings.employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </Field>

        <div className="card-group">
          <div className="kv"><span>Checked in</span><b>{when(job.intakeAt)}</b></div>
          <div className="kv"><span>Phone</span><b>{customer.phone || 'None'}</b></div>
          <div className="kv"><span>Email</span><b>{customer.email || 'None'}</b></div>
        </div>

        <Field label="Notes">
          <textarea
            rows={3} value={notes} placeholder="Work notes…"
            onChange={(e) => setLocalNotes(e.target.value)}
            onBlur={() => notes !== job.notes && setNotes(job.id, notes)}
          />
        </Field>

        <div className="toggle-row">
          <div>
            <strong>Automatic messages</strong>
            <p>
              {job.notify
                ? 'The customer is texted and emailed at Ready for Pickup and Closed.'
                : 'Off. Nothing will be sent for this job.'}
            </p>
          </div>
          <Switch checked={job.notify} onChange={(v) => setNotify(job.id, v)} label="Automatic messages" />
        </div>

        {resendKind && (
          <button className="btn" onClick={() => sendMessages(job.id, resendKind)}>
            {resendKind === 'ready' ? 'Send pickup message again' : 'Send thank-you again'}
          </button>
        )}

        <section>
          <h3 className="eyebrow">Activity</h3>
          <ol className="timeline">
            {[...job.events].reverse().map((e, i) => (
              <li key={i}><span>{e.text}</span><time>{when(e.at)}</time></li>
            ))}
          </ol>
        </section>

        {sent.length > 0 && (
          <section>
            <h3 className="eyebrow">Messages sent</h3>
            <ul className="mini-msgs">
              {sent.map((m) => (
                <li key={m.id}>
                  <Icon name={m.channel === 'sms' ? 'sms' : 'mail'} />
                  <div><b>{m.to}</b> <DeliveryTag m={m} /><p>{m.body}</p>{m.status === 'failed' && m.error && <p className="fail-note">{m.error}</p>}</div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  )
}
