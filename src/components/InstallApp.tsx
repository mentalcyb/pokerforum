'use client'
import { useEffect, useState } from 'react'
import { useApp } from '@/contexts/AppContext'

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

const DISMISS_KEY = 'pf-install-dismissed'

/**
 * Registers the service worker and offers "Install the app":
 * Android/desktop Chrome get the browser's install prompt; iPhone gets short Add-to-Home-Screen steps.
 */
export default function InstallApp() {
  const { t } = useApp()
  const [evt, setEvt] = useState<InstallEvent | null>(null)
  const [ios, setIos] = useState(false)
  const [show, setShow] = useState(false)

  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {})
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone
    let dismissed = false
    try { dismissed = Date.now() - Number(localStorage.getItem(DISMISS_KEY) || 0) < 14 * 86400_000 } catch {}
    const ua = navigator.userAgent
    const mobile = /android|iphone|ipad|ipod/i.test(ua)
    if (standalone || dismissed) return
    setIos(/iphone|ipad|ipod/i.test(ua))
    // Chrome may offer its own install prompt; we keep it for the button
    const onPrompt = (e: Event) => { e.preventDefault(); setEvt(e as InstallEvent); setShow(true) }
    window.addEventListener('beforeinstallprompt', onPrompt)
    // On phones always show the card after a few seconds — with the install button when the
    // browser supports it, otherwise with short manual steps (Safari, Samsung Internet, etc.)
    const id = mobile ? setTimeout(() => setShow(true), 4000) : undefined
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); if (id) clearTimeout(id) }
  }, [])

  function dismiss() {
    setShow(false)
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())) } catch {}
  }

  async function install() {
    if (!evt) return
    await evt.prompt()
    await evt.userChoice.catch(() => null)
    setEvt(null); setShow(false)
  }

  if (!show) return null
  return (
    <div className="fixed inset-x-3 bottom-3 z-50 sm:left-auto sm:right-4 sm:w-96 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-2xl p-4">
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="" width={44} height={44} className="rounded-xl" />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-gray-900 dark:text-white text-sm">{t.installTitle}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{ios ? t.installIosSteps : evt ? t.installHint : t.installAndroidSteps}</div>
        </div>
        <button onClick={dismiss} className="text-gray-400 hover:text-gray-600 text-lg leading-none" aria-label="close">✕</button>
      </div>
      {!ios && evt && (
        <button onClick={install} className="mt-3 w-full py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold">
          📲 {t.installButton}
        </button>
      )}
    </div>
  )
}
