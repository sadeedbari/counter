// Sends one queued message through Resend (email) or Twilio (SMS).
// Called by the database trigger `messages_dispatch` with { id }. Deployed with verify_jwt = false:
// it accepts nothing but a message id and only sends rows that are still 'queued', so a stray call
// cannot send anything that was not legitimately queued by a status change or a Resend click.
//
// Secrets (Edge Functions > Secrets):
//   RESEND_API_KEY, RESEND_FROM            e.g. notifications@yourdomain.com (verified in Resend)
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM   (or TWILIO_MESSAGING_SERVICE_SID instead of FROM)
import { createClient } from 'jsr:@supabase/supabase-js@2'

const env = (k: string) => Deno.env.get(k) ?? ''
const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function toE164(raw: string): string | null {
  const d = raw.replace(/\D/g, '')
  if (raw.trim().startsWith('+') && d.length >= 8) return `+${d}`
  if (d.length === 10) return `+1${d}`
  if (d.length === 11 && d.startsWith('1')) return `+${d}`
  return null
}

async function sendEmail(to: string, subject: string, body: string, storeName: string) {
  if (!env('RESEND_API_KEY') || !env('RESEND_FROM')) throw new Error('Resend is not configured')
  const html = `<div style="font:16px/1.5 -apple-system,Segoe UI,sans-serif;color:#1d1d1f;max-width:520px">
    <p style="white-space:pre-wrap;margin:0 0 24px">${escapeHtml(body).replace(
      /(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>')}</p>
    <p style="color:#6e6e73;font-size:13px;margin:0">${escapeHtml(storeName)}</p></div>`
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: `${storeName} <${env('RESEND_FROM')}>`, to, subject, text: body, html }),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.message ?? `Resend ${r.status}`)
  return j.id as string
}

async function sendSms(to: string, body: string) {
  const sid = env('TWILIO_ACCOUNT_SID'), token = env('TWILIO_AUTH_TOKEN')
  const from = env('TWILIO_FROM'), svc = env('TWILIO_MESSAGING_SERVICE_SID')
  if (!sid || !token || (!from && !svc)) throw new Error('Twilio is not configured')
  const phone = toE164(to)
  if (!phone) throw new Error(`Invalid phone number: ${to}`)
  const form = new URLSearchParams({ To: phone, Body: body })
  if (svc) form.set('MessagingServiceSid', svc)
  else form.set('From', from)
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: `Basic ${btoa(`${sid}:${token}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.message ?? `Twilio ${r.status}`)
  return j.sid as string
}

Deno.serve(async (req) => {
  const { id } = await req.json().catch(() => ({}))
  if (typeof id !== 'string') return new Response('bad request', { status: 400 })

  const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'))

  // Claim atomically so a message is never sent twice.
  const { data: m } = await db
    .from('messages').update({ status: 'sending' }).eq('id', id).eq('status', 'queued')
    .select('*, stores(name)').maybeSingle()
  if (!m) return new Response('nothing to send')

  try {
    const storeName = m.stores?.name ?? 'Your shop'
    const providerId = m.channel === 'email'
      ? await sendEmail(m.to_address, m.subject ?? storeName, m.body, storeName)
      : await sendSms(m.to_address, m.body)
    await db.from('messages').update({ status: 'sent', provider_id: providerId, error: null }).eq('id', id)
    return new Response('sent')
  } catch (e) {
    await db.from('messages').update({ status: 'failed', error: String((e as Error).message).slice(0, 300) }).eq('id', id)
    return new Response('failed', { status: 200 })
  }
})
