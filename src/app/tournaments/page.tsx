'use client'
import { useState } from 'react'
import tournaments from '@/data/tournaments.json'

type Tournament = typeof tournaments[0]

const SERIES = ['All', 'EPT', 'WPT', 'WSOP Europe', 'WSOP Circuit', 'RPT', 'Merit', 'APT', 'Local']
const ADMIN_EMAIL = 'admin@pokerforum.ge'

function seriesColor(series: string) {
  const map: Record<string, string> = {
    EPT: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
    WPT: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
    'WSOP Europe': 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
    'WSOP Circuit': 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
    RPT: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
    Merit: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400',
    APT: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
    Local: 'bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400',
  }
  return map[series] ?? 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
}

function TournamentCard({ t }: { t: Tournament }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 hover:border-brand-300 dark:hover:border-brand-700 transition-colors">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${seriesColor(t.series)}`}>
              {t.series}
            </span>
            {t.country === 'GE' && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-brand-600 text-white">
                🏠 Local
              </span>
            )}
          </div>
          <h3 className="font-bold text-gray-900 dark:text-white text-base leading-snug">{t.name}</h3>
        </div>
        <span className="text-2xl flex-shrink-0">{t.flag}</span>
      </div>

      <div className="space-y-1.5 mb-4">
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <span className="text-gray-400">📍</span>
          <span>{t.location}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <span className="text-gray-400">📅</span>
          <span>{t.dates}</span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-gray-400">🎟</span>
            <span className="font-semibold text-gray-900 dark:text-white">{t.buyin}</span>
          </div>
          {t.guarantee && (
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-400">GTD</span>
              <span className="text-sm font-semibold text-brand-600">{t.guarantee}</span>
            </div>
          )}
        </div>
        {t.notes && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 italic">{t.notes}</p>
        )}
      </div>

      <a
        href={t.website}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700 dark:hover:text-brand-400 transition-colors"
      >
        Official website →
      </a>
    </div>
  )
}

export default function TournamentsPage() {
  const [activeSeries, setActiveSeries] = useState('All')
  const [search, setSearch] = useState('')

  const filtered = tournaments.filter(t => {
    const matchSeries = activeSeries === 'All' || t.series === activeSeries
    const matchSearch = search === '' ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.location.toLowerCase().includes(search.toLowerCase())
    return matchSeries && matchSearch
  })

  const submitSubject = encodeURIComponent('Tournament Submission – pokerforum.ge')
  const submitBody = encodeURIComponent(
    'Tournament Name:\nLocation:\nDates:\nBuy-in:\nGuarantee:\nWebsite:\nNotes:\n'
  )

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center text-white text-xl">🏆</div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">Upcoming Tournaments</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">Near Georgia · Within 2–4 hours flight</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mt-2">
              EPT, WPT, WSOP Europe and more — tournaments accessible from Tbilisi.
              Includes Turkey 🇹🇷, Greece 🇬🇷, Czech Republic 🇨🇿, Austria 🇦🇹, UAE 🇦🇪, Romania 🇷🇴, Bulgaria 🇧🇬, Cyprus 🇨🇾 and local Georgia 🇬🇪 events.
            </p>
          </div>
          <a
            href={`mailto:${ADMIN_EMAIL}?subject=${submitSubject}&body=${submitBody}`}
            className="flex-shrink-0 inline-flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            + Submit a tournament
          </a>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5 items-center">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search tournaments or locations…"
          className="flex-1 min-w-48 px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <div className="flex flex-wrap gap-1.5">
          {SERIES.map(s => (
            <button
              key={s}
              onClick={() => setActiveSeries(s)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors ${
                activeSeries === s
                  ? 'bg-brand-600 border-brand-600 text-white'
                  : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-brand-400'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Count */}
      <p className="text-xs text-gray-400 mb-4">{filtered.length} tournament{filtered.length !== 1 ? 's' : ''}</p>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-4xl mb-3">🔍</div>
          <p>No tournaments match your filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(t => <TournamentCard key={t.id} t={t} />)}
        </div>
      )}

      {/* Footer note */}
      <div className="mt-8 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl">
        <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
          <strong>⚠ Dates and guarantees may change.</strong> Always verify on the official tournament website before booking travel.
          Know about a tournament we missed?{' '}
          <a href={`mailto:${ADMIN_EMAIL}?subject=${submitSubject}&body=${submitBody}`} className="underline font-semibold">
            Submit it here
          </a>.
        </p>
      </div>
    </div>
  )
}
