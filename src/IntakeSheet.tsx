import { useRef, useState } from 'react'
import { createJob, useStore } from './store'
import { Field, Icon, Switch } from './ui'

/** Shrink phone photos so they stay small enough to store and send. */
function shrink(file: File, max = 1100): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const r = Math.min(1, max / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * r)
      c.height = Math.round(img.height * r)
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(url)
      resolve(c.toDataURL('image/jpeg', 0.72))
    }
    img.onerror = reject
    img.src = url
  })
}

export function IntakeSheet({ onDone, onClose }: { onDone: (jobId: string) => void; onClose: () => void }) {
  const { settings, customers } = useStore()
  const [f, setF] = useState({ name: '', email: '', phone: '', item: '', notes: '', assigneeId: '' })
  const [photo, setPhoto] = useState<string>()
  const [notify, setNotify] = useState(true)
  const [tried, setTried] = useState(false)
  const file = useRef<HTMLInputElement>(null)
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) =>
    setF((p) => ({ ...p, [k]: e.target.value }))

  const returning = customers.find(
    (c) =>
      (f.email && c.email.toLowerCase() === f.email.trim().toLowerCase()) ||
      (f.phone.replace(/\D/g, '').length >= 7 && c.phone.replace(/\D/g, '') === f.phone.replace(/\D/g, '')),
  )
  const errors = {
    name: !f.name.trim() && !returning ? 'Add a name' : '',
    contact: !f.email.trim() && !f.phone.trim() ? 'Add an email or a phone number' : '',
    item: !f.item.trim() ? 'What are we working on?' : '',
  }
  const invalid = Object.values(errors).some(Boolean)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setTried(true)
    if (invalid) return
    const job = createJob({ ...f, name: f.name || returning!.name, photo, notify, assigneeId: f.assigneeId || undefined })
    onDone(job.id)
  }

  return (
    <form className="sheet-body" onSubmit={submit} noValidate>
      <header className="sheet-head">
        <div>
          <h2>New check-in</h2>
          <p>{new Date().toLocaleString([], { weekday: 'long', hour: 'numeric', minute: '2-digit' })}</p>
        </div>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
      </header>

      <div className="stack">
        <Field label="Customer name" error={tried ? errors.name : ''}>
          <input autoFocus value={f.name} onChange={set('name')} placeholder="Full name" autoComplete="off" />
        </Field>
        <div className="row2">
          <Field label="Phone" error={tried ? errors.contact : ''}>
            <input value={f.phone} onChange={set('phone')} inputMode="tel" placeholder="(555) 555-0100" />
          </Field>
          <Field label="Email">
            <input value={f.email} onChange={set('email')} inputMode="email" placeholder="name@email.com" />
          </Field>
        </div>
        {returning && (
          <p className="note-ok">
            Returning customer: {returning.name}. This visit will be added to their history.
          </p>
        )}

        <Field label="Item" error={tried ? errors.item : ''}>
          <input value={f.item} onChange={set('item')} placeholder="Trek road bike, blue" />
        </Field>
        <Field label="What needs doing" hint="Optional">
          <textarea rows={3} value={f.notes} onChange={set('notes')} placeholder="Gears skipping, brakes squeal…" />
        </Field>

        <div className="photo-row">
          {photo ? (
            <div className="photo-thumb">
              <img src={photo} alt="Customer item" />
              <button type="button" className="icon-btn dark" onClick={() => setPhoto(undefined)} aria-label="Remove photo">
                <Icon name="x" />
              </button>
            </div>
          ) : (
            <button type="button" className="photo-add" onClick={() => file.current?.click()}>
              <Icon name="camera" /> Add a photo
            </button>
          )}
          <input
            ref={file} type="file" accept="image/*" capture="environment" hidden
            onChange={async (e) => {
              const picked = e.target.files?.[0]
              if (picked) setPhoto(await shrink(picked))
              e.target.value = ''
            }}
          />
        </div>

        <Field label="Assign to">
          <select value={f.assigneeId} onChange={set('assigneeId')}>
            <option value="">Unassigned</option>
            {settings.employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </Field>

        <div className="toggle-row">
          <div>
            <strong>Automatic messages</strong>
            <p>Text and email the customer when it’s ready and when it’s picked up.</p>
          </div>
          <Switch checked={notify} onChange={setNotify} label="Automatic messages" />
        </div>
      </div>

      <footer className="sheet-foot">
        <button type="submit" className="btn primary wide">Create job</button>
      </footer>
    </form>
  )
}
