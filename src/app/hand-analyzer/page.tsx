'use client'
import { useState } from 'react'

const SAMPLE_PS = `PokerStars Hand #243000000001: Hold'em No Limit ($0.25/$0.50 USD) - 2024/05/01 20:00:00 ET
Table 'TableName' 6-max Seat #1 is the button
Seat 1: BTN ($50 in chips)
Seat 2: SB ($48 in chips)
Seat 3: BB ($52 in chips)
Seat 4: Hero ($55 in chips)
SB: posts small blind $0.25
BB: posts big blind $0.50
*** HOLE CARDS ***
Dealt to Hero [Ah Kd]
Hero: raises $1.50 to $2
BTN: folds
SB: folds
BB: calls $1.50
*** FLOP *** [Ac 7h 2d]
BB: checks
Hero: bets $2.50
BB: calls $2.50
*** TURN *** [Ac 7h 2d] [Ks]
BB: checks
Hero: bets $6
BB: raises $15 to $21
Hero: calls $15
*** RIVER *** [Ac 7h 2d Ks] [7d]
BB: bets $26.50 and is all-in
Hero: folds
*** SUMMARY ***
Total pot $46.50`

type StreetResult = { assessment: string; status: 'ok' | 'warning' | 'error'; note: string } | null

type Analysis = {
  summary: string
  preflop: StreetResult
  flop: StreetResult
  turn: StreetResult
  river: StreetResult
  keyMistake: string | null
  discussion: string
}

const STATUS_STYLES = {
  ok: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800',
  warning: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800',
  error: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800',
}
const STATUS_ICON = { ok: '✓', warning: '⚠', error: '✗' }
const STATUS_LABEL = { ok: 'Good', warning: 'Questionable', error: 'Mistake' }

export default function HandAnalyzerPage() {
  const [handHistory, setHandHistory] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [analysis, setAnalysis] = useState<Analysis | null>(null)

  async function analyze() {
    if (!handHistory.trim()) { setError('Please paste a hand history first.'); return }
    setLoading(true)
    setError('')
    setAnalysis(null)
    try {
      const res = await fetch('/api/analyze-hand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handHistory }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Analysis failed.'); return }
      setAnalysis(data.analysis)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const streets: { key: keyof Analysis; label: string }[] = [
    { key: 'preflop', label: 'Preflop' },
    { key: 'flop', label: 'Flop' },
    { key: 'turn', label: 'Turn' },
    { key: 'river', label: 'River' },
  ]

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center text-white text-xl">🤖</div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">AI Hand Analyzer</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">PokerStars &amp; GGPoker formats</p>
          </div>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-3 leading-relaxed">
          Paste your hand history below for a street-by-street breakdown. The AI acts as a discussion
          starter — bring the analysis to the forum for community debate.
        </p>
      </div>

      {/* Input */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 mb-5">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Hand History</label>
          <button
            onClick={() => setHandHistory(SAMPLE_PS)}
            className="text-xs text-brand-600 hover:text-brand-700 font-medium"
          >
            Load example
          </button>
        </div>
        <textarea
          value={handHistory}
          onChange={e => setHandHistory(e.target.value)}
          placeholder="Paste PokerStars or GGPoker hand history here..."
          rows={12}
          className="w-full text-xs font-mono bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-gray-800 dark:text-gray-200 resize-y focus:outline-none focus:ring-2 focus:ring-brand-500 placeholder-gray-400"
        />
        {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
        <button
          onClick={analyze}
          disabled={loading}
          className="mt-3 w-full py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
              Analyzing…
            </span>
          ) : '🤖 Analyze Hand'}
        </button>
      </div>

      {/* Results */}
      {analysis && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-2">Hand Summary</h2>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{analysis.summary}</p>
          </div>

          {/* Street breakdown */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
              <h2 className="font-semibold text-gray-900 dark:text-white">Street Breakdown</h2>
            </div>
            {streets.map(({ key, label }) => {
              const s = analysis[key] as StreetResult
              if (!s) return null
              return (
                <div key={key} className="px-5 py-4 border-b border-gray-50 dark:border-gray-800 last:border-0">
                  <div className="flex items-start gap-3">
                    <span className={`flex-shrink-0 mt-0.5 inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded border ${STATUS_STYLES[s.status]}`}>
                      {STATUS_ICON[s.status]} {STATUS_LABEL[s.status]}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">{label}</div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white leading-snug">{s.assessment}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 leading-relaxed">{s.note}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Key mistake */}
          {analysis.keyMistake && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-5">
              <div className="flex items-start gap-3">
                <span className="text-xl flex-shrink-0">🎯</span>
                <div>
                  <h3 className="font-semibold text-red-800 dark:text-red-300 mb-1">Key Spot to Improve</h3>
                  <p className="text-sm text-red-700 dark:text-red-400 leading-relaxed">{analysis.keyMistake}</p>
                </div>
              </div>
            </div>
          )}

          {/* Discussion starter */}
          <div className="bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <span className="text-xl flex-shrink-0">💬</span>
              <div>
                <h3 className="font-semibold text-brand-800 dark:text-brand-300 mb-1">Discussion Starter</h3>
                <p className="text-sm text-brand-700 dark:text-brand-400 leading-relaxed">{analysis.discussion}</p>
              </div>
            </div>
            <a
              href="/new-post"
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 dark:text-brand-400 hover:text-brand-900 dark:hover:text-brand-200 transition-colors"
            >
              Post this hand to the forum →
            </a>
          </div>
        </div>
      )}

      <p className="mt-8 text-center text-xs text-gray-400 dark:text-gray-600">
        Powered by Claude AI · Built with Claude Code
      </p>
    </div>
  )
}
