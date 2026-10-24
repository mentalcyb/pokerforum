'use client'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useApp } from '@/contexts/AppContext'

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

const DISMISS_KEY = 'pf-install-dismissed'
const VISITS_KEY = 'pf-visits'
const DISMISS_DAYS = 30
const FIRST_VISIT_DELAY_MS = 25_000
const RETURN_VISIT_DELAY_MS = 5_000
/** Never cover these pages (a game in progress, signing in). */
const QUIET_PATHS = [/^\/home-games\/.+/, /^\/auth/]

const read = (k: string) => { try { return localStorage.getItem(k) } catch { return null } }
const write = (k: string, v: string) => { try { localStorage.setItem(k, v) } catch {} }

export function isStandaloneApp(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches || !!(navigator as unknown as { standalone?: boolean }).standalone
}

/** Ask the install card to open (used by the "Install app" menu item). */
export function openInstallCard() {
  window.dispatchEvent(new Event('pf-open-install'))
}

/**
 * Registers the service worker and gently offers "Install the app" on phones:
 * a small card at the bottom — on a return visit (or after 25s on the first one), never during a game,
 * and after ✕ not again for 30 days. The menu item can always open it on request.
 */
export default function InstallApp() {
  const { t } = useApp()
  const pathname = usePathname()
  const [evt, setEvt] = useState<InstallEvent | null>(null)
  const [ios, setIos] = useState(false)
  const [show, setShow] = useState(false)
  const [visible, setVisible] = useState(false) // for the slide-in animation

  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {})
    const ua = navigator.userAgent
    setIos(/iphone|ipad|ipod/i.test(ua))
    const onPrompt = (e: Event) => { e.preventDefault(); setEvt(e as InstallEvent) }
    const onOpen = () => setShow(true)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('pf-open-install', onOpen)
    const onInstalled = () => { setShow(false); setEvt(null) }
    window.addEventListener('appinstalled', onInstalled)

    // count visits (once per browser session)
    let visits = Number(read(VISITS_KEY) || 0)
    try {
      if (!sessionStorage.getItem('pf-counted')) { visits += 1; write(VISITS_KEY, String(visits)); sessionStorage.setItem('pf-counted', '1') }
    } catch {}

    const mobile = /android|iphone|ipad|ipod/i.test(ua)
    const dismissed = Date.now() - Number(read(DISMISS_KEY) || 0) < DISMISS_DAYS * 86400_000
    let id: ReturnType<typeof setTimeout> | undefined
    if (mobile && !dismissed && !isStandaloneApp()) {
      id = setTimeout(() => setShow(true), visits >= 2 ? RETURN_VISIT_DELAY_MS : FIRST_VISIT_DELAY_MS)
    }
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('pf-open-install', onOpen)
      window.removeEventListener('appinstalled', onInstalled)
      if (id) clearTimeout(id)
    }
  }, [])

  const quiet = QUIET_PATHS.some(re => re.test(pathname || ''))
  const open = show && !quiet

  useEffect(() => {
    if (!open) { setVisible(false); return }
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [open])

  function dismiss() {
    setShow(false)
    write(DISMISS_KEY, String(Date.now()))
  }

  async function install() {
    if (!evt) return
    await evt.prompt()
    const choice = await evt.userChoice.catch(() => null)
    setEvt(null); setShow(false)
    if (choice?.outcome !== 'accepted') write(DISMISS_KEY, String(Date.now()))
  }

  if (!open) return null
  return (
    <div className={`fixed inset-x-3 bottom-3 z-50 sm:left-auto sm:right-4 sm:w-96 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 backdrop-blur shadow-xl p-3.5 transition-all duration-300 ${visible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'}`}>
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="" width={40} height={40} className="rounded-xl shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-gray-900 dark:text-white text-sm">{t.installTitle}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">
            {ios ? t.installIosSteps : evt ? t.installHint : t.installAndroidSteps}
          </div>
        </div>
        {!ios && evt && (
          <button onClick={install} className="shrink-0 px-3 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold">
            {t.installButton}
          </button>
        )}
        <button onClick={dismiss} className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="close">✕</button>
      </div>
    </div>
  )
}
