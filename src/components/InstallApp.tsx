'use client'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useApp } from '@/contexts/AppContext'

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

const DISMISS_KEY = 'pf-install-dismissed'
const INSTALLED_KEY = 'pf-installed'
const VISITS_KEY = 'pf-visits'
const DISMISS_DAYS = 30
const FIRST_VISIT_DELAY_MS = 10_000
const RETURN_VISIT_DELAY_MS = 5_000
/** Never cover these pages (a game in progress, signing in). */
const QUIET_PATHS = [/^\/home-games\/.+/, /^\/auth/]

const read = (k: string) => { try { return localStorage.getItem(k) } catch { return null } }
const write = (k: string, v: string) => { try { localStorage.setItem(k, v) } catch {} }

function platformOf(ua: string): string {
  if (/android/i.test(ua)) return 'android'
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios'
  if (/windows|macintosh|linux|cros/i.test(ua)) return 'desktop'
  return 'other'
}

/** Anonymous app statistics: a random id for this device, and at most one ping per kind per day. */
function track(kind: 'install' | 'open') {
  try {
    let device = localStorage.getItem('pf-device')
    if (!device) { device = crypto.randomUUID(); localStorage.setItem('pf-device', device) }
    const today = new Date().toISOString().slice(0, 10)
    const key = `pf-track-${kind}`
    if (localStorage.getItem(key) === today) return
    localStorage.setItem(key, today)
    fetch('/api/app-event', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true,
      body: JSON.stringify({ device, kind, platform: platformOf(navigator.userAgent) }),
    }).catch(() => {})
  } catch {}
}

export function isStandaloneApp(): boolean {
  if (typeof window === 'undefined') return false
  // The installed app always starts at /?source=app (see manifest.webmanifest). Some phones
  // (e.g. Xiaomi) don't report "standalone" display mode, so the start URL is remembered for this session.
  try {
    if (new URLSearchParams(window.location.search).get('source') === 'app') sessionStorage.setItem('pf-app', '1')
    if (sessionStorage.getItem('pf-app') === '1') return true
  } catch {}
  return ['standalone', 'fullscreen', 'minimal-ui'].some(m => window.matchMedia(`(display-mode: ${m})`).matches)
    || !!(navigator as unknown as { standalone?: boolean }).standalone
}

/** Ask the install card to open (used by the "Install app" menu item). */
export function openInstallCard() {
  window.dispatchEvent(new Event('pf-open-install'))
}

/**
 * Registers the service worker and gently offers "Install the app" on phones:
 * a small card at the bottom — on a return visit (or after 10s on the first one), never during a game,
 * and after ✕ not again for 30 days. The menu item can always open it on request.
 */
export default function InstallApp() {
  const { t } = useApp()
  const pathname = usePathname()
  const [evt, setEvt] = useState<InstallEvent | null>(null)
  const [ios, setIos] = useState(false)
  // iPhone but not Safari (Chrome, Instagram/Facebook in-app browser…): must open in Safari first
  const [iosOther, setIosOther] = useState(false)
  const [copied, setCopied] = useState(false)
  const [show, setShow] = useState(false)
  const [visible, setVisible] = useState(false) // for the slide-in animation

  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {})
    const ua = navigator.userAgent
    // opened as the installed app (counts iPhones too, which don't report installs)
    if (isStandaloneApp()) { track('open'); write(INSTALLED_KEY, '1') }
    const isIos = /iphone|ipad|ipod/i.test(ua)
    setIos(isIos)
    setIosOther(isIos && (/crios|fxios|edgios|opios|instagram|fban|fbav|line\/|telegram/i.test(ua) || !/safari/i.test(ua)))
    const onPrompt = (e: Event) => { e.preventDefault(); setEvt(e as InstallEvent) }
    const onOpen = () => setShow(true)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('pf-open-install', onOpen)
    const onInstalled = () => { setShow(false); setEvt(null); track('install'); write(INSTALLED_KEY, '1') }
    window.addEventListener('appinstalled', onInstalled)

    // count visits (once per browser session)
    let visits = Number(read(VISITS_KEY) || 0)
    try {
      if (!sessionStorage.getItem('pf-counted')) { visits += 1; write(VISITS_KEY, String(visits)); sessionStorage.setItem('pf-counted', '1') }
    } catch {}

    const mobile = /android|iphone|ipad|ipod/i.test(ua)
    const dismissed = Date.now() - Number(read(DISMISS_KEY) || 0) < DISMISS_DAYS * 86400_000
    let id: ReturnType<typeof setTimeout> | undefined
    // only for people who don't have the app yet
    const installedHere = read(INSTALLED_KEY) === '1'
    if (mobile && !dismissed && !installedHere && !isStandaloneApp()) {
      id = setTimeout(async () => {
        // Chrome on Android can tell whether this site's app is already installed on the phone
        try {
          const apps = await (navigator as unknown as { getInstalledRelatedApps?: () => Promise<unknown[]> }).getInstalledRelatedApps?.()
          if (apps && apps.length) { write(INSTALLED_KEY, '1'); return }
        } catch {}
        setShow(true)
      }, visits >= 2 ? RETURN_VISIT_DELAY_MS : FIRST_VISIT_DELAY_MS)
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

  async function copyLink() {
    try { await navigator.clipboard.writeText('https://pokerforum.ge'); setCopied(true) } catch {}
  }

  if (!open) return null

  // iPhone: Apple allows no install button, so show the two Safari taps with pictures
  if (ios) {
    return (
      <>
        {!iosOther && <div className={`fixed left-1/2 -translate-x-1/2 bottom-1 z-50 text-3xl animate-bounce transition-opacity ${visible ? 'opacity-100' : 'opacity-0'}`} aria-hidden>⬇️</div>}
        <div className={`fixed inset-x-3 bottom-12 z-50 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 backdrop-blur shadow-xl p-4 transition-all duration-300 ${visible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'}`}>
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/icon-192.png" alt="" width={40} height={40} className="rounded-xl shrink-0" />
            <div className="flex-1 font-semibold text-gray-900 dark:text-white text-sm">{t.installTitle}</div>
            <button onClick={dismiss} className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="close">✕</button>
          </div>
          {iosOther ? (
            <div className="mt-3 text-sm text-gray-700 dark:text-gray-300">
              <p>{t.installIosOpenSafari}</p>
              <button onClick={copyLink} className="mt-2 w-full py-2 rounded-xl bg-brand-600 text-white text-sm font-semibold">
                {copied ? `✓ ${t.installCopied}` : `📋 ${t.installCopyLink}`}
              </button>
            </div>
          ) : (
            <ol className="mt-3 space-y-2 text-sm text-gray-700 dark:text-gray-300">
              <li className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-brand-600 text-white text-xs font-bold flex items-center justify-center shrink-0">1</span>
                <span className="flex-1">{t.installIosStep1}</span>
                {/* Safari share icon */}
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0a84ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M12 3v12"/><path d="M8 7l4-4 4 4"/><path d="M6 11v8a2 2 0 002 2h8a2 2 0 002-2v-8"/></svg>
              </li>
              <li className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-brand-600 text-white text-xs font-bold flex items-center justify-center shrink-0">2</span>
                <span className="flex-1">{t.installIosStep2}</span>
                {/* "Add to Home Screen" icon */}
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 text-gray-700 dark:text-gray-200"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M12 8v8M8 12h8"/></svg>
              </li>
            </ol>
          )}
        </div>
      </>
    )
  }

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
