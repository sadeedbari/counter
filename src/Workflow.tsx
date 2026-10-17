import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { setPhases, useStore } from './store'
import { PHASE_COLORS, TEMPLATES, type Phase, type PhaseKind } from './types'
import { Icon, phaseColor } from './ui'

const ROLES: { id: PhaseKind; label: string; hint: string }[] = [
  { id: 'active', label: 'Regular step', hint: 'No message is sent.' },
  { id: 'ready', label: 'Ready for pickup', hint: 'Sends the pickup message.' },
  { id: 'closed', label: 'Finished', hint: 'Sends the thank-you and counts the job as done.' },
]

const spring = { type: 'spring', bounce: 0, duration: 0.35 } as const
const same = (a: Phase[], b: Phase[]) =>
  a.length === b.length && a.every((p, i) => p.id === b[i].id && p.name === b[i].name && p.color === b[i].color && p.kind === b[i].kind)

export function Workflow() {
  const { settings, jobs } = useStore()
  const saved = settings.phases
  const [draft, setDraft] = useState<Phase[]>(saved)
  const [picking, setPicking] = useState<string | null>(null)
  const [error, setError] = useState<string>()
  const [saving, setSaving] = useState(false)
  const dirty = !same(draft, saved)

  // Follow outside changes (initial load, another device) until the user starts editing.
  useEffect(() => {
    if (!dirty) setDraft(saved)
  }, [saved]) // eslint-disable-line react-hooks/exhaustive-deps

  const patch = (id: string, p: Partial<Phase>) => setDraft((d) => d.map((x) => (x.id === id ? { ...x, ...p } : x)))
  const move = (i: number, by: -1 | 1) =>
    setDraft((d) => {
      const n = [...d]
      ;[n[i], n[i + by]] = [n[i + by], n[i]]
      return n
    })

  const applyTemplate = (id: string) => {
    const t = TEMPLATES.find((x) => x.id === id)!
    // Keep a job in "the same" phase: reuse an existing phase with the same name, else the same
    // pickup/finished role, so a job that was Ready for Pickup stays ready.
    const free = new Map(saved.map((p) => [p.id, p]))
    const take = (match: (p: Phase) => boolean) => {
      const hit = [...free.values()].find(match)
      if (hit) free.delete(hit.id)
      return hit?.id
    }
    const ids = t.phases.map((p) => take((s) => s.name.trim().toLowerCase() === p.name.toLowerCase()))
    setDraft(
      t.phases.map((p, i) => ({
        ...p,
        id: ids[i] ?? (p.kind !== 'active' ? take((s) => s.kind === p.kind) : undefined) ?? crypto.randomUUID(),
      })),
    )
    setError(undefined)
  }

  // Jobs in a removed phase move to whatever phase ends up at the same position.
  const moves = useMemo(() => {
    const keep = new Set(draft.map((p) => p.id))
    return saved.flatMap((p, i) => {
      const count = jobs.filter((j) => j.status === p.id).length
      return keep.has(p.id) || !count ? [] : [{ from: p.name, count, to: draft[Math.min(i, draft.length - 1)]?.name }]
    })
  }, [draft, saved, jobs])

  const warnings = [
    !draft.some((p) => p.kind === 'ready') && 'No “Ready for pickup” phase, so customers won’t get a pickup message.',
    !draft.some((p) => p.kind === 'closed') && 'No “Finished” phase, so customers won’t get a thank-you and jobs never leave the board.',
    draft.filter((p) => p.kind === 'ready').length > 1 && 'More than one “Ready for pickup” phase: customers still get only one pickup message per job.',
  ].filter(Boolean) as string[]

  async function save() {
    setSaving(true)
    const err = await setPhases(draft)
    setSaving(false)
    setError(err ?? undefined)
  }

  return (
    <section className="card">
      <div>
        <h3>Workflow</h3>
        <p className="muted">Name the phases a job moves through. Pick what happens at each one.</p>
      </div>

      <div className="chips" role="group" aria-label="Start from a template">
        {TEMPLATES.map((t) => (
          <button key={t.id} type="button" className="chip" onClick={() => applyTemplate(t.id)}>
            {t.label} <small>{t.blurb}</small>
          </button>
        ))}
      </div>

      <ol className="phase-list">
        <AnimatePresence initial={false}>
          {draft.map((p, i) => (
            <motion.li
              key={p.id} layout transition={spring}
              initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }}
              className="phase-row"
            >
              <div className="swatch-wrap">
                <button
                  type="button" className="swatch" style={phaseColor(p.color)} aria-label={`Colour: ${p.color}`}
                  aria-expanded={picking === p.id} onClick={() => setPicking(picking === p.id ? null : p.id)}
                />
                {picking === p.id && (
                  <div className="swatch-pop" role="listbox" aria-label="Colour">
                    {PHASE_COLORS.map((c) => (
                      <button
                        key={c} type="button" role="option" aria-selected={c === p.color} aria-label={c}
                        className={`swatch ${c === p.color ? 'on' : ''}`} style={phaseColor(c)}
                        onClick={() => { patch(p.id, { color: c }); setPicking(null) }}
                      />
                    ))}
                  </div>
                )}
              </div>

              <input
                className="phase-name" value={p.name} maxLength={28} aria-label={`Phase ${i + 1} name`}
                onChange={(e) => patch(p.id, { name: e.target.value })} placeholder="Phase name"
              />

              <select value={p.kind} aria-label={`${p.name || 'Phase'} role`} onChange={(e) => patch(p.id, { kind: e.target.value as PhaseKind })}>
                {ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>

              <div className="row-actions">
                <button type="button" className="icon-btn" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up"><span className="rot-up"><Icon name="chev" /></span></button>
                <button type="button" className="icon-btn" disabled={i === draft.length - 1} onClick={() => move(i, 1)} aria-label="Move down"><span className="rot-down"><Icon name="chev" /></span></button>
                <button type="button" className="icon-btn" disabled={draft.length <= 1} onClick={() => setDraft((d) => d.filter((x) => x.id !== p.id))} aria-label="Remove phase"><Icon name="x" /></button>
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>

      <button
        type="button" className="btn" disabled={draft.length >= 10}
        onClick={() => setDraft((d) => [...d, { id: crypto.randomUUID(), name: '', color: 'purple', kind: 'active' }])}
      >
        <Icon name="plus" /> Add a phase
      </button>

      {warnings.map((w) => <p key={w} className="warn">{w}</p>)}
      {moves.map((m) => (
        <p key={m.from} className="warn">{m.count} {m.count === 1 ? 'job' : 'jobs'} in “{m.from}” will move to “{m.to}”. Customers won’t be messaged.</p>
      ))}
      {error && <p className="form-err" role="alert">{error}</p>}

      <AnimatePresence>
        {dirty && (
          <motion.div
            className="save-bar" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={spring}
          >
            <button type="button" className="link" onClick={() => { setDraft(saved); setError(undefined) }}>Discard</button>
            <button type="button" className="btn primary" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save workflow'}</button>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
