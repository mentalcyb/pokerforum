'use client'
import { useState } from 'react'
import tournaments, { type Tournament } from '@/data/tournaments'

const SERIES = ['All', 'EPT', 'WPT', 'WSOP Europe', 'WSOP Circuit', 'RPT', 'Merit', 'APT', 'Local']

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

// ── Submit modal ──────────────────────────────────────────────────────────────

type SubmitForm = {
  name: string; location: string; dates: string
  buyin: string; guarantee: string; website: string; submitted_by: string
}
const EMPTY_FORM: SubmitForm = { name: '', location: '', dates: '', buyin: '', guarantee: '', website: '', submitted_by: '' }

function SubmitModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState<SubmitForm>(EMPTY_FORM)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const set = (k: keyof SubmitForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.location.trim() || !form.dates.trim()) {
      setError('Please fill in name, location and dates.')
      return
    }
    setLoading(true)
    setError('')
    // Lazy import — keeps Supabase out of the SSR bundle for this page
    const { createClient } = await import('@/lib/supabase')
    const supabase = createClient()
    const { error: err } = await supabase.from('tournament_submissions').insert({
      name: form.name.trim(),
      location: form.location.trim(),
      dates: form.dates.trim(),
      buyin: form.buyin.trim(),
      guarantee: form.guarantee.trim(),
      website: form.website.trim(),
      submitted_by: form.submitted_by.trim(),
      status: 'pending',
    })
    setLoading(false)
    if (err) { setError(err.message); return }
    setDone(true)
  }

  const inputClass = 'w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="font-bold text-gray-900 dark:text-white">Submit a Tournament</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">✕</button>
        </div>

        {done ? (
          <div className="px-6 py-10 text-center">
            <div className="text-4xl mb-3">✅</div>
            <h3 className="font-bold text-gray-900 dark:text-white mb-1">Thanks for the submission!</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">We'll review it and add it to the page soon.</p>
            <button onClick={onClose} className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-xl transition-colors">Close</button>
          </div>
        ) : (
          <form onSubmit={submit} className="px-6 py-5 space-y-3">
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Tournament Name *</label>
              <input value={form.name} onChange={set('name')} placeholder="e.g. EPT Barcelona" className={inputClass} required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Location *</label>
              <input value={form.location} onChange={set('location')} placeholder="e.g. Barcelona, Spain" className={inputClass} required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Dates *</label>
              <input value={form.dates} onChange={set('dates')} placeholder="e.g. Aug 10–20, 2026" className={inputClass} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Buy-in</label>
                <input value={form.buyin} onChange={set('buyin')} placeholder="e.g. €5,300" className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Guarantee</label>
                <input value={form.guarantee} onChange={set('guarantee')} placeholder="e.g. €5,000,000" className={inputClass} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Website</label>
              <input value={form.website} onChange={set('website')} placeholder="https://..." type="url" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Your name / email (optional)</label>
              <input value={form.submitted_by} onChange={set('submitted_by')} placeholder="optional" className={inputClass} />
            </div>

            <button type="submit" disabled={loading} className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors mt-1">
              {loading ? 'Submitting…' : 'Submit Tournament'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TournamentsPage() {
  const [activeSeries, setActiveSeries] = useState('All')
  const [search, setSearch] = useState('')
  const [showSubmit, setShowSubmit] = useState(false)

  // Debug: verify data is loaded
  console.log('[tournaments] array length:', Array.isArray(tournaments) ? tournaments.length : 'NOT AN ARRAY', tournaments)

  const list: Tournament[] = Array.isArray(tournaments) ? tournaments : []

  const filtered = list.filter(t => {
    const matchSeries = activeSeries === 'All' || t.series === activeSeries
    const matchSearch = search === '' ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.location.toLowerCase().includes(search.toLowerCase())
    return matchSeries && matchSearch
  })

  console.log('[tournaments] filtered length:', filtered.length, '| activeSeries:', activeSeries, '| search:', search)

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {showSubmit && <SubmitModal onClose={() => setShowSubmit(false)} />}

      {/* Header */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center text-white text-xl">🏆</div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">Offline Poker Series</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">Near Georgia · Within 2–4 hours flight</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mt-2">
              EPT, WPT, WSOP Europe and more — tournaments accessible from Tbilisi.
              Includes Turkey 🇹🇷, Greece 🇬🇷, Czech Republic 🇨🇿, Austria 🇦🇹, UAE 🇦🇪, Romania 🇷🇴, Bulgaria 🇧🇬, Cyprus 🇨🇾 and local Georgia 🇬🇪 events.
            </p>
          </div>
          <button
            onClick={() => setShowSubmit(true)}
            className="flex-shrink-0 inline-flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            + Submit a tournament
          </button>
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
      <p className="text-xs text-gray-400 mb-4">
        {filtered.length} tournament{filtered.length !== 1 ? 's' : ''}
        {process.env.NODE_ENV !== 'production' && (
          <span className="ml-2 text-red-400">(total in data: {list.length})</span>
        )}
      </p>

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
          <button onClick={() => setShowSubmit(true)} className="underline font-semibold">Submit it here</button>.
        </p>
      </div>
    </div>
  )
}
