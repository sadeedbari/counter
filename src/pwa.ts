import { useEffect, useState } from 'react'

/** Register the service worker (production builds only, so dev hot-reload isn't cached). */
export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

interface InstallEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const standalone = () =>
  matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true

const isIos = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

let deferred: InstallEvent | null = null
const subs = new Set<() => void>()
addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  deferred = e as InstallEvent
  subs.forEach((f) => f())
})
addEventListener('appinstalled', () => {
  deferred = null
  subs.forEach((f) => f())
})

/**
 * How this device can install the app:
 *  'prompt'  a native install dialog is available (Chrome, Edge, Android)
 *  'ios'     Safari on iPhone/iPad: Share, then Add to Home Screen
 *  'none'    already installed, or the browser can't install
 */
export function useInstall() {
  const [, tick] = useState(0)
  useEffect(() => {
    const f = () => tick((n) => n + 1)
    subs.add(f)
    return () => void subs.delete(f)
  }, [])
  const mode: 'prompt' | 'ios' | 'none' = standalone() ? 'none' : deferred ? 'prompt' : isIos() ? 'ios' : 'none'
  async function install() {
    if (!deferred) return
    await deferred.prompt()
    await deferred.userChoice
    deferred = null
    tick((n) => n + 1)
  }
  return { mode, install }
}

export function useOnline() {
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    addEventListener('online', on)
    addEventListener('offline', off)
    return () => {
      removeEventListener('online', on)
      removeEventListener('offline', off)
    }
  }, [])
  return online
}
