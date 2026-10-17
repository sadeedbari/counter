// Counter service worker: makes the app installable and lets the shell open offline.
// Only same-origin GETs are handled. Supabase (database, auth, storage, functions) is a different
// origin and always goes straight to the network, so customer data is never served stale from here.
const SHELL = 'counter-shell-v1'
const ASSETS = 'counter-assets-v1'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL).then((c) => c.addAll(['/', '/manifest.webmanifest', '/icon-192.png', '/favicon.svg'])).then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== ASSETS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  const url = new URL(req.url)
  if (req.method !== 'GET' || url.origin !== self.location.origin) return

  // Pages: network first so a new deploy shows up immediately; fall back to the cached shell offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(SHELL).then((c) => c.put('/', copy))
          return res
        })
        .catch(() => caches.match('/').then((r) => r ?? Response.error())),
    )
    return
  }

  // Built files have content hashes in their names, so cached copies never go stale.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ??
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone()
              caches.open(ASSETS).then((c) => c.put(req, copy))
            }
            return res
          }),
      ),
    )
    return
  }

  // Icons and the manifest: cache, but refresh in the background.
  event.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req).then((res) => {
        if (res.ok) caches.open(SHELL).then((c) => c.put(req, res.clone()))
        return res
      })
      return hit ?? net
    }),
  )
})
