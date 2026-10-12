'use client'
import { useEffect, useRef, useState } from 'react'
import { useApp } from '@/contexts/AppContext'
import type { Lang } from '@/lib/translations'

// Flag images instead of emoji: emoji flags don't render on Windows.
const LANGUAGES: { code: Lang; label: string; flag: string }[] = [
  { code: 'ka', label: 'ქართული', flag: 'https://flagcdn.com/w20/ge.png' },
  { code: 'en', label: 'English', flag: 'https://flagcdn.com/w20/gb.png' },
]

function Flag({ src }: { src: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} width={20} height={14} alt="" className="inline-block rounded-[2px] shadow-sm" />
}

/** Desktop: a button showing the current language that opens a small menu. */
export function LanguageDropdown() {
  const { lang, setLang } = useApp()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = LANGUAGES.find(l => l.code === lang) ?? LANGUAGES[0]

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="h-8 px-2 flex items-center gap-1.5 text-sm rounded-md border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors font-medium text-gray-700 dark:text-gray-300"
      >
        <Flag src={current.flag} />
        <span className="uppercase text-xs">{current.code === 'ka' ? 'ქარ' : 'EN'}</span>
        <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <ul role="listbox" aria-label="Language"
          className="absolute right-0 mt-1.5 w-40 py-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl z-50">
          {LANGUAGES.map(l => (
            <li key={l.code}>
              <button
                role="option"
                aria-selected={l.code === lang}
                onClick={() => { setLang(l.code); setOpen(false) }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 ${
                  l.code === lang ? 'font-semibold text-brand-600' : 'text-gray-700 dark:text-gray-300'
                }`}
              >
                <Flag src={l.flag} />
                <span className="flex-1">{l.label}</span>
                {l.code === lang && <span aria-hidden>✓</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Mobile menu: both languages side by side, one tap to switch. */
export function LanguageSegmented() {
  const { lang, setLang } = useApp()
  return (
    <div className="flex-1 flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden" role="radiogroup">
      {LANGUAGES.map(l => (
        <button
          key={l.code}
          role="radio"
          aria-checked={l.code === lang}
          onClick={() => setLang(l.code)}
          className={`flex-1 py-2 flex items-center justify-center gap-1.5 text-sm font-medium transition-colors ${
            l.code === lang ? 'bg-brand-600 text-white' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          <Flag src={l.flag} />
          {l.label}
        </button>
      ))}
    </div>
  )
}
