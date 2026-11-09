import { useEffect, useRef, useState, type ReactNode } from 'react'
import './landing.css'

const VIDEO = { id: 'LQRV3uDI21A', title: 'What is Counter?' }

const go = (view: 'signin' | 'signup') => () => {
  location.hash = view
}

/** Fades sections in as they scroll into view. No-op for reduced motion. */
function Reveal({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
      el?.classList.add('in')
      return
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          el.classList.add('in')
          io.disconnect()
        }
      },
      { threshold: 0.15 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return <div ref={ref} className={`reveal ${className}`}>{children}</div>
}

const FEATURES: { title: string; body: string; icon: ReactNode }[] = [
  {
    title: 'Check-in in seconds',
    body: 'Name, phone or email, and one photo of the item. Every job is time-stamped the moment it’s created.',
    icon: <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7H8l1.2-2h5.6L16 7h2.5A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5zM12 15.8a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z" />,
  },
  {
    title: 'Your own workflow',
    body: 'Name the phases however your shop works, pick their colours, and start from a template if you like.',
    icon: <path d="M4 5.5h5v13H4zM10.5 5.5h4v8h-4zM16 5.5h4v10.5h-4z" />,
  },
  {
    title: 'Customers hear from you',
    body: 'A text and an email go out when it’s ready for pickup, and again to say thanks. Your words, your shop’s name.',
    icon: <path d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5h-7l-4.5 3.5v-3.5H5A1.5 1.5 0 0 1 3.5 15V7A1.5 1.5 0 0 1 5 5.5z" />,
  },
  {
    title: 'In control of every message',
    body: 'One checkbox per job turns automatic messages off. Resend any message with a tap if a customer missed it.',
    icon: <path d="M7 12h10M12 7v10M4 12a8 8 0 1 0 16 0 8 8 0 0 0-16 0z" />,
  },
  {
    title: 'A book of every customer',
    body: 'Search by name, email, phone or item. See each visit with its exact date and time, and when they first came in.',
    icon: <path d="M9 11.5a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4zM3.5 19c.6-3 3-4.6 5.5-4.6s4.9 1.6 5.5 4.6M16 5.6a3 3 0 0 1 0 5.8M18 14.6c1.5.6 2.5 2 2.8 4.4" />,
  },
  {
    title: 'Works like an app',
    body: 'Open it on a phone, tablet or the counter computer. Install it to the home screen and it opens full screen.',
    icon: <path d="M8 3.5h8a1.5 1.5 0 0 1 1.5 1.5v14a1.5 1.5 0 0 1-1.5 1.5H8A1.5 1.5 0 0 1 6.5 19V5A1.5 1.5 0 0 1 8 3.5zM10.5 18h3" />,
  },
]

const FOR = ['Bike shops', 'Phone and computer repair', 'Shoe and leather repair', 'Tailors and alterations', 'Small engine and mower repair', 'Appliance repair', 'Watch and jewellery repair', 'Any walk-in service counter']

export default function Landing() {
  useEffect(() => {
    document.title = 'Counter: check-in and job tracking for walk-in shops'
  }, [])

  return (
    <div className="lp">
      <header className="lp-nav">
        <a className="lp-brand" href="#top" aria-label="Counter home">
          <span className="logo">C</span>
          <b>Counter</b>
        </a>
        <nav aria-label="Sections">
          <a href="#features">Features</a>
          <a href="#how">How it works</a>
        </nav>
        <div className="lp-nav-cta">
          <button className="lp-link" onClick={go('signin')}>Sign in</button>
          <button className="btn primary" onClick={go('signup')}>Get started</button>
        </div>
      </header>

      <main id="top">
        {/* ── hero ── */}
        <section className="lp-hero">
          <p className="lp-eyebrow">For walk-in service shops</p>
          <h1>Every repair, from drop-off to pickup.</h1>
          <p className="lp-sub">
            Counter is the check-in desk for shops where customers walk in. Log a job in seconds, follow it through your
            workshop, and let customers know the moment it’s ready.
          </p>
          <div className="lp-cta">
            <button className="btn primary big" onClick={go('signup')}>Get started</button>
            <a className="btn big ghost" href="#how">See how it works</a>
          </div>

          <VideoPlayer />
        </section>

        {/* ── board at a glance ── */}
        <section className="lp-section lp-glance">
          <Reveal>
            <p className="lp-eyebrow">The workshop board</p>
            <h2>See every job at a glance.</h2>
            <p className="lp-lede">Each job moves across your phases. Tap to open it, change its status, assign it, and see what the customer has been sent.</p>
          </Reveal>
          <Reveal><div className="lp-stage" aria-hidden="true">
            <div className="lp-window">
              <div className="lp-bar"><i /><i /><i /><span>Workshop</span></div>
              <div className="lp-cols">
                <Col name="New" color="blue" n={1}>
                  <Card initials="LF" who="Lena Fischer" item="Specialized Rockhopper" meta="Unassigned · Today, 1:39 AM" next="In Progress" />
                </Col>
                <Col name="In Progress" color="orange" n={1}>
                  <Card initials="PR" who="Priya Raman" item="Trek Domane road bike" meta="Maya · Oct 15, 9:02 PM" next="Complete" />
                </Col>
                <Col name="Ready for Pickup" color="green" n={1}>
                  <Card initials="DO" who="Daniel Okafor" item="Brompton folding bike" meta="Jordan · Oct 16, 6:40 PM" next="Closed" />
                </Col>
              </div>
            </div>
            <div className="lp-phone">
              <div className="lp-phone-top">Spoke &amp; Chain Cycles</div>
              <p className="lp-bubble">Hi Daniel, your Brompton folding bike is ready for pickup at Spoke &amp; Chain Cycles. See you soon!</p>
              <span className="lp-delivered">Delivered</span>
            </div>
          </div></Reveal>
        </section>

        {/* ── how it works ── */}
        <section id="how" className="lp-section">
          <Reveal>
            <h2>Three steps at the counter.</h2>
            <p className="lp-lede">No training, no paper tags, no “did we call them?”</p>
          </Reveal>
          <div className="lp-steps">
            {[
              ['1', 'Check in', 'A customer walks in. You add their name, how to reach them, and a photo of what they brought.'],
              ['2', 'Work', 'Move the job through your phases and assign it to someone on your team. Everyone sees where it stands.'],
              ['3', 'Pick up', 'When it’s ready, the customer is texted and emailed. When they collect it, close the job and a thank-you goes out with your review link.'],
            ].map(([n, t, b]) => (
              <Reveal key={n} className="lp-step">
                <span className="lp-num">{n}</span>
                <h3>{t}</h3>
                <p>{b}</p>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── messages ── */}
        <section className="lp-section lp-split">
          <Reveal className="lp-copy">
            <p className="lp-eyebrow">Automatic messages</p>
            <h2>The call you never have to make.</h2>
            <p className="lp-lede">
              Reaching Ready for Pickup sends a text and an email in your shop’s voice. Closing the job says thank you and
              asks for a Google review. Write both messages once, and use a customer’s name, their item and your shop name
              wherever you like.
            </p>
            <ul className="lp-ticks">
              <li>Sent only by the channels each customer has: text, email, or both</li>
              <li>One checkbox per job turns messages off</li>
              <li>See what was sent and when, and resend with a tap</li>
            </ul>
          </Reveal>
          <Reveal className="lp-visual">
            <div className="lp-chat" aria-hidden="true">
              <p className="lp-bubble">Hi Daniel, your Brompton folding bike is ready for pickup at Spoke &amp; Chain Cycles. We’re open Tue–Sat, 10–6. See you soon!</p>
              <p className="lp-bubble alt">Thanks for visiting Spoke &amp; Chain Cycles, Daniel! If we did right by you, a quick review means the world to us.</p>
            </div>
          </Reveal>
        </section>

        {/* ── features ── */}
        <section id="features" className="lp-section">
          <Reveal>
            <h2>Everything a counter needs. Nothing it doesn’t.</h2>
          </Reveal>
          <div className="lp-grid">
            {FEATURES.map((f) => (
              <Reveal key={f.title} className="lp-feature">
                <span className="lp-ico">
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{f.icon}</svg>
                </span>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── who ── */}
        <section className="lp-section lp-for">
          <Reveal>
            <h2>Built for the shops people walk into.</h2>
            <ul className="lp-chips">
              {FOR.map((x) => <li key={x}>{x}</li>)}
            </ul>
          </Reveal>
        </section>

        {/* ── final cta ── */}
        <section className="lp-final">
          <Reveal>
            <h2>Set up your counter in a few minutes.</h2>
            <p className="lp-lede">Create your shop, name your phases, and check in your first customer today.</p>
            <div className="lp-cta center">
              <button className="btn primary big" onClick={go('signup')}>Get started</button>
              <button className="btn big ghost" onClick={go('signin')}>Sign in</button>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="lp-foot">
        <span className="lp-brand"><span className="logo">C</span><b>Counter</b></span>
        <span className="lp-credit">
          © {new Date().getFullYear()} Counter · Designed and built by{' '}
          <a href="https://sulosystems.com" target="_blank" rel="noopener">sulosystems.com</a>
        </span>
      </footer>
    </div>
  )
}

function Col({ name, color, n, children }: { name: string; color: string; n: number; children: ReactNode }) {
  return (
    <div className="lp-col">
      <h4 style={{ '--c': `var(--c-${color})` } as React.CSSProperties}><i />{name}<span>{n}</span></h4>
      {children}
    </div>
  )
}

function Card({ initials, who, item, meta, next }: { initials: string; who: string; item: string; meta: string; next: string }) {
  return (
    <div className="lp-card">
      <div className="lp-card-top">
        <span className="avatar">{initials}</span>
        <div><b>{who}</b><p>{item}</p></div>
      </div>
      <small>{meta}</small>
      <span className="lp-adv">{next} ›</span>
    </div>
  )
}

/** Poster first; the YouTube player (privacy-enhanced domain) loads only when someone presses play. */
function VideoPlayer() {
  const [playing, setPlaying] = useState(false)
  return (
    <div className="lp-video">
      {playing ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${VIDEO.id}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
          title={VIDEO.title}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : (
        <button className="lp-poster" onClick={() => setPlaying(true)} aria-label={`Play video: ${VIDEO.title}`}>
          <span className="lp-poster-brand"><span className="logo">C</span>Counter</span>
          <span className="lp-play" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor"><path d="M8.5 5.6v12.8a.8.8 0 0 0 1.2.7l10.4-6.4a.8.8 0 0 0 0-1.4L9.7 4.9a.8.8 0 0 0-1.2.7z" /></svg>
          </span>
          <span className="lp-poster-text">
            <small>Watch the overview</small>
            <b>{VIDEO.title}</b>
          </span>
        </button>
      )}
    </div>
  )
}
