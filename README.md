# Counter

Check-in and job tracking for walk-in service shops (bike repair, etc.): intake with photo, status board,
automatic ready-for-pickup and thank-you texts/emails, searchable customer book.

## Run

```
npm install
cp .env.example .env.local   # fill in the Supabase URL + publishable key; leave empty for demo mode
npm run dev
```

With no env vars the app runs in demo mode (data in the browser, messages logged not delivered).

## Backend (Supabase project "Walk-in Counter")

- `supabase/migrations/` apply in order. Multi-tenant via RLS (`my_store()`), one store per signed-in user.
- A status change to Ready for Pickup / Closed queues rows in `messages` (trigger `jobs_status`), a second
  trigger hands each to the `send-messages` Edge Function (`supabase/functions/send-messages`), which
  sends via Resend (email) / Twilio (SMS) and records `sent` / `failed` + error.
- Edge Function secrets: `RESEND_API_KEY`, `RESEND_FROM`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`,
  and `TWILIO_FROM` (or `TWILIO_MESSAGING_SERVICE_SID`). Until set, messages show as Failed ("not configured").
- Job photos: private Storage bucket `job-photos`, one folder per store.

## Install as an app (PWA)

Counter is an installable web app (manifest, icons, service worker in `public/`). It needs to be served
over HTTPS (localhost also works) for the browser to offer "Install". The service worker only registers in
production builds (`npm run build`). It caches the app shell so Counter opens offline; the database, auth,
photos and message sending always go to the network, so changes can't be saved offline.

- Chrome / Edge / Android: Install button in Settings (or the browser's install icon).
- iPhone / iPad: Safari → Share → Add to Home Screen (Settings shows the steps).
- Home-screen shortcut "New check-in" opens `/?new=1`.
