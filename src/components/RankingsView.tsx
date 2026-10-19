'use client'
import { useApp } from '@/contexts/AppContext'
import { GEORGIA_TOP, RANKINGS_SOURCE_URL, RANKINGS_UPDATED, formatUsd } from '@/data/rankings'

const MEDALS = ['🥇', '🥈', '🥉']

export default function RankingsView() {
  const { t } = useApp()
  const d = new Date(RANKINGS_UPDATED)
  const updated = `${d.getDate()} ${t.months[d.getMonth()]} ${d.getFullYear()}`

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center text-white text-xl">🏅</div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t.rankingsTitle}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t.rankingsSubtitle}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="grid grid-cols-[3rem_1fr_auto] gap-2 px-4 sm:px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400 border-b border-gray-100 dark:border-gray-800">
          <span>#</span><span>{t.rankingsPlayer}</span><span className="text-right">{t.rankingsEarnings}</span>
        </div>
        {GEORGIA_TOP.map(p => (
          <div key={p.rank}
            className={`grid grid-cols-[3rem_1fr_auto] gap-2 items-center px-4 sm:px-5 py-3 border-b border-gray-50 dark:border-gray-800 last:border-0 ${p.rank <= 3 ? 'bg-amber-50/60 dark:bg-amber-900/10' : ''}`}>
            <span className={`font-bold ${p.rank <= 3 ? 'text-lg' : 'text-sm text-gray-400'}`}>{MEDALS[p.rank - 1] ?? p.rank}</span>
            <span className="flex items-center gap-2 min-w-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="https://flagcdn.com/w20/ge.png" width={20} height={14} alt="GE" className="inline-block rounded-[2px] shrink-0" />
              <span className={`truncate ${p.rank <= 3 ? 'font-semibold text-gray-900 dark:text-white' : 'text-gray-800 dark:text-gray-200'}`}>{p.name}</span>
            </span>
            <span className="text-right font-semibold tabular-nums text-brand-600">{formatUsd(p.earnings)}</span>
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs text-gray-400 leading-relaxed">
        {t.rankingsNote} {t.rankingsUpdated}: {updated}. {t.newsSourceLabel}:{' '}
        <a href={RANKINGS_SOURCE_URL} target="_blank" rel="noopener noreferrer nofollow" className="underline hover:text-brand-600">The Hendon Mob</a>
      </p>
    </div>
  )
}
