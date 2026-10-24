'use client'
import { useEffect, useState } from 'react'
import { useApp } from '@/contexts/AppContext'
import { createClient } from '@/lib/supabase'
import { isStandaloneApp } from '@/components/InstallApp'

type Stats = { installed: number; today: number; active7: number; active30: number; platforms: Record<string, number>; error?: string }

/** Admin panel: how many people installed / use the pokerforum.ge app. */
export default function AppStatsCard() {
  const { t } = useApp()
  const [s, setS] = useState<Stats | null>(null)
  const [check, setCheck] = useState<string | null>(null)

  async function load() {
    const { data } = await createClient().auth.getSession()
    const tk = data.session?.access_token
    if (!tk) return
    const res = await fetch('/api/admin/app-stats', { headers: { Authorization: `Bearer ${tk}` } })
    if (res.ok) setS(await res.json())
  }
  useEffect(() => { load() }, [])

  /** Sends a test ping from this browser and shows exactly what the server answered. */
  async function runCheck() {
    setCheck('…')
    try {
      let device = localStorage.getItem('pf-device')
      if (!device) { device = crypto.randomUUID(); localStorage.setItem('pf-device', device) }
      const standalone = isStandaloneApp()
      const res = await fetch('/api/app-event', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device, kind: 'open', platform: /android/i.test(navigator.userAgent) ? 'android' : /iphone|ipad/i.test(navigator.userAgent) ? 'ios' : 'desktop' }),
      })
      const json = await res.json().catch(() => ({}))
      setCheck(`${res.status} ${JSON.stringify(json)} · app-mode: ${standalone ? 'yes' : 'no'}`)
      load()
    } catch (e) { setCheck(String(e)) }
  }

  if (!s) return null
  if (s.error) return <div className="mb-6 p-4 rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10 text-sm text-amber-800 dark:text-amber-300">{t.appStatsSetup}</div>

  const tiles: [string, number][] = [[t.appStatsInstalled, s.installed], [t.appStatsToday, s.today], [t.appStats7, s.active7], [t.appStats30, s.active30]]
  const p = s.platforms
  return (
    <div className="mb-6 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
      <div className="font-semibold text-gray-900 dark:text-white mb-3">📲 {t.appStatsTitle}</div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {tiles.map(([label, n]) => (
          <div key={label} className="rounded-xl bg-gray-50 dark:bg-gray-800/60 p-3">
            <div className="text-2xl font-bold text-brand-600 tabular-nums">{n}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
        <span>Android: {p.android ?? 0} · iPhone: {p.ios ?? 0} · {t.appStatsComputer}: {p.desktop ?? 0}</span>
        <button onClick={runCheck} className="ml-auto px-2.5 py-1 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">🔍 {t.appStatsCheck}</button>
      </div>
      {check && <pre className="mt-2 text-[11px] whitespace-pre-wrap break-all text-gray-500">{check}</pre>}
    </div>
  )
}
