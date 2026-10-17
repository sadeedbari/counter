import { AnimatePresence, motion, useDragControls } from 'motion/react'
import { useEffect, useState, type ReactNode } from 'react'
import { useStore } from './store'

export function useWide() {
  const q = '(min-width: 900px)'
  const [wide, setWide] = useState(() => matchMedia(q).matches)
  useEffect(() => {
    const m = matchMedia(q)
    const on = () => setWide(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])
  return wide
}

/** Apple's momentum projection: where a flick would come to rest. */
const project = (v: number, rate = 0.998) => ((v / 1000) * rate) / (1 - rate)

export function Sheet({
  open, onClose, label, children,
}: { open: boolean; onClose: () => void; label: string; children: ReactNode }) {
  const wide = useWide()
  const controls = useDragControls()

  useEffect(() => {
    if (!open) return
    const on = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    addEventListener('keydown', on)
    return () => removeEventListener('keydown', on)
  }, [open, onClose])

  // Enter and exit along the same path: from the right on desktop, from the bottom on phones.
  const off = wide ? { x: '104%' } : { y: '104%' }
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="scrim"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
          />
          <motion.aside
            className={wide ? 'panel' : 'sheet'}
            role="dialog" aria-modal="true" aria-label={label}
            initial={off} animate={{ x: 0, y: 0 }} exit={off}
            transition={{ type: 'spring', bounce: 0, duration: 0.45 }}
            drag={wide ? false : 'y'} dragListener={false} dragControls={controls}
            dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0.04, bottom: 0.7 }}
            onDragEnd={(_, i) => {
              if (i.offset.y + project(i.velocity.y) > 200) onClose()
            }}
          >
            {!wide && <div className="grabber" onPointerDown={(e) => controls.start(e)}><i /></div>}
            {children}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

export const phaseColor = (c: string) => ({ '--c': `var(--c-${c})` }) as React.CSSProperties

export function StatusPill({ status }: { status: string }) {
  const { settings } = useStore()
  const p = settings.phases.find((x) => x.id === status) ?? settings.phases[0]
  return (
    <span className="pill" style={phaseColor(p.color)}>
      <i />
      {p.name}
    </span>
  )
}

export function Switch({
  checked, onChange, label,
}: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button" role="switch" aria-checked={checked} aria-label={label}
      className="switch" onClick={() => onChange(!checked)}
    >
      <motion.span
        layout
        transition={{ type: 'spring', bounce: 0.15, duration: 0.3 }}
        style={{ x: checked ? 20 : 0 }}
        animate={{ x: checked ? 20 : 0 }}
      />
    </button>
  )
}

export function Avatar({ name }: { name: string }) {
  const initials = name.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()
  return <span className="avatar">{initials || '?'}</span>
}

export function Field({
  label, hint, error, children,
}: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {error ? <em className="err">{error}</em> : hint ? <em>{hint}</em> : null}
    </label>
  )
}

export function when(iso: string) {
  const d = new Date(iso)
  const mins = Math.round((Date.now() - d.getTime()) / 60_000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins} min ago`
  if (mins < 60 * 24 && new Date().getDate() === d.getDate())
    return `Today, ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function Icon({ name }: { name: 'board' | 'people' | 'chat' | 'gear' | 'plus' | 'search' | 'x' | 'mail' | 'sms' | 'camera' | 'chev' }) {
  const p = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' } as const
  const paths: Record<string, ReactNode> = {
    board: <><rect x="3.5" y="4" width="5" height="16" rx="1.5" {...p} /><rect x="10.5" y="4" width="5" height="10" rx="1.5" {...p} /><rect x="17.5" y="4" width="3" height="13" rx="1.5" {...p} /></>,
    people: <><circle cx="9" cy="8.5" r="3.2" {...p} /><path d="M3.5 19c.6-3 3-4.6 5.5-4.6s4.9 1.6 5.5 4.6" {...p} /><path d="M16 5.6a3 3 0 0 1 0 5.8M18 14.6c1.5.6 2.5 2 2.8 4.4" {...p} /></>,
    chat: <path d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 19 16.5h-7l-4.5 3.5v-3.5H5A1.5 1.5 0 0 1 3.5 15V7A1.5 1.5 0 0 1 5 5.5z" {...p} />,
    gear: <><circle cx="12" cy="12" r="3" {...p} /><path d="M12 3.5v2.2M12 18.3v2.2M20.5 12h-2.2M5.7 12H3.5M18 6l-1.6 1.6M7.6 16.4 6 18M18 18l-1.6-1.6M7.6 7.6 6 6" {...p} /></>,
    plus: <path d="M12 5v14M5 12h14" {...p} />,
    search: <><circle cx="11" cy="11" r="6" {...p} /><path d="m20 20-4.2-4.2" {...p} /></>,
    x: <path d="M6 6l12 12M18 6 6 18" {...p} />,
    mail: <><rect x="3.5" y="5.5" width="17" height="13" rx="2" {...p} /><path d="m4 7 8 6 8-6" {...p} /></>,
    sms: <path d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 19 16.5h-7l-4.5 3.5v-3.5H5A1.5 1.5 0 0 1 3.5 15V7A1.5 1.5 0 0 1 5 5.5z" {...p} />,
    camera: <><path d="M4 8.5A1.5 1.5 0 0 1 5.5 7H8l1.2-2h5.6L16 7h2.5A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z" {...p} /><circle cx="12" cy="12.5" r="3.3" {...p} /></>,
    chev: <path d="m9 6 6 6-6 6" {...p} />,
  }
  return <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>{paths[name]}</svg>
}
