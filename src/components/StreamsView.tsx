'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useApp } from '@/contexts/AppContext'
import { createClient } from '@/lib/supabase'
import PokerAvatar from '@/components/PokerAvatar'
import type { Streamer, Platform } from '@/lib/streams'

const PLATFORM_LABEL: Record<Platform, string> = { twitch: 'Twitch', youtube: 'YouTube' }
const PLATFORM_BADGE: Record<Platform, string> = {
  twitch: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
  youtube: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
}

function channelUrl(s: { platform: Platform; channel: string }) {
  if (s.platform === 'twitch') return `https://www.twitch.tv/${s.channel}`
  return s.channel.startsWith('@') ? `https://www.youtube.com/${s.channel}` : `https://www.youtube.com/channel/${s.channel}`
}

function Player({ s }: { s: Streamer }) {
  const [host, setHost] = useState<string | null>(null)
  useEffect(() => setHost(window.location.hostname), [])
  if (!host) return <div className="aspect-video bg-black rounded-2xl" />
  const src = s.platform === 'twitch'
    ? `https://player.twitch.tv/?channel=${s.channel}&parent=${host}&autoplay=true&muted=false`
    : `https://www.youtube.com/embed/${s.video_id}?autoplay=1`
  return (
    <iframe key={s.id} src={src} className="w-full aspect-video rounded-2xl bg-black" allowFullScreen
      allow="autoplay; encrypted-media; picture-in-picture; fullscreen" title={s.title ?? s.channel} />
  )
}

type MyChannel = { id: number; platform: Platform; channel: string; approved: boolean }
type AdminChannel = MyChannel & { created_at: string; profiles: { username: string } | null }

export default function StreamsView({ streams }: { streams: Streamer[] }) {
  const { t } = useApp()
  const live = streams.filter(s => s.is_live && (s.platform === 'twitch' || s.video_id))
  const offline = streams.filter(s => !live.includes(s))
  const [selected, setSelected] = useState<Streamer | null>(live[0] ?? null)

  const [token, setToken] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [mine, setMine] = useState<MyChannel[]>([])
  const [platform, setPlatform] = useState<Platform>('twitch')
  const [input, setInput] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [all, setAll] = useState<AdminChannel[]>([])

  const auth = (tk: string) => ({ Authorization: `Bearer ${tk}` })

  async function loadMine(tk: string) {
    const res = await fetch('/api/streams/me', { headers: auth(tk) })
    if (res.ok) setMine((await res.json()).channels ?? [])
  }
  async function loadAll(tk: string) {
    const res = await fetch('/api/streams/admin', { headers: auth(tk) })
    if (res.ok) setAll((await res.json()).channels ?? [])
  }

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data }) => {
      const session = data.session
      if (!session) return
      setToken(session.access_token)
      loadMine(session.access_token)
      const { data: p } = await supabase.from('profiles').select('is_admin').eq('id', session.user.id).single()
      if (p?.is_admin) { setIsAdmin(true); loadAll(session.access_token) }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function save() {
    if (!token || !input.trim()) return
    setSaving(true); setMsg(null)
    try {
      const res = await fetch('/api/streams/me', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...auth(token) },
        body: JSON.stringify({ platform, input }),
      })
      const json = await res.json()
      if (!res.ok) setMsg(json.error === 'invalid' ? t.streamsInvalid : `⚠️ ${json.error}`)
      else { setMsg(json.approved ? t.streamsSavedApproved : t.streamsSavedPending); setInput(''); loadMine(token); if (isAdmin) loadAll(token) }
    } catch { setMsg(t.networkError) } finally { setSaving(false) }
  }

  async function remove(p: Platform) {
    if (!token || !confirm(t.streamsConfirmRemove)) return
    await fetch(`/api/streams/me?platform=${p}`, { method: 'DELETE', headers: auth(token) })
    loadMine(token); if (isAdmin) loadAll(token)
  }

  async function adminAction(id: number, action: 'approve' | 'remove') {
    if (!token || (action === 'remove' && !confirm(t.streamsConfirmRemove))) return
    const res = await fetch('/api/streams/admin', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...auth(token) },
      body: JSON.stringify({ id, action }),
    })
    if (res.ok) loadAll(token)
  }

  const pending = all.filter(c => !c.approved)

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center text-white text-xl">📺</div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t.streamsTitle}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t.streamsSubtitle}</p>
        </div>
      </div>

      {/* Admin: channels waiting for approval */}
      {isAdmin && pending.length > 0 && (
        <div className="mb-6 p-4 rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10">
          <div className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-2">⏳ {t.streamsPending(pending.length)}</div>
          <div className="space-y-2">
            {pending.map(c => (
              <div key={c.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${PLATFORM_BADGE[c.platform]}`}>{PLATFORM_LABEL[c.platform]}</span>
                <span className="font-medium text-gray-900 dark:text-white">{c.profiles?.username ?? '—'}</span>
                <a href={channelUrl(c)} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">{c.channel} ↗</a>
                <span className="ml-auto flex gap-2">
                  <button onClick={() => adminAction(c.id, 'approve')} className="px-3 py-1 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold">✓ {t.streamsApprove}</button>
                  <button onClick={() => adminAction(c.id, 'remove')} className="px-3 py-1 rounded-lg border border-red-300 text-red-600 text-xs font-semibold">✕ {t.streamsReject}</button>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Live now */}
      {live.length > 0 ? (
        <div className="mb-8">
          {selected && (
            <div className="mb-4">
              <Player s={selected} />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-red-600 text-white">● LIVE</span>
                <span className="font-semibold text-gray-900 dark:text-white">{selected.profiles?.username ?? selected.channel}</span>
                <span className="text-sm text-gray-500 truncate flex-1 min-w-0">{selected.title}</span>
                <a href={channelUrl(selected)} target="_blank" rel="noopener noreferrer" className="text-sm text-brand-600 hover:underline">{t.streamsOpenOn(PLATFORM_LABEL[selected.platform])} ↗</a>
              </div>
            </div>
          )}
          <h2 className="font-semibold text-gray-900 dark:text-white mb-3">🔴 {t.streamsLiveNow} ({live.length})</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {live.map(s => (
              <button key={s.id} onClick={() => { setSelected(s); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                className={`text-left bg-white dark:bg-gray-900 rounded-2xl border overflow-hidden hover:shadow-md transition ${selected?.id === s.id ? 'border-brand-500 ring-2 ring-brand-500/30' : 'border-gray-200 dark:border-gray-800'}`}>
                <div className="relative aspect-video bg-gray-900">
                  {s.thumbnail && (/* eslint-disable-next-line @next/next/no-img-element */
                    <img src={s.thumbnail} alt="" className="w-full h-full object-cover" loading="lazy" />)}
                  <span className="absolute top-2 left-2 text-[11px] font-bold px-2 py-0.5 rounded bg-red-600 text-white">● LIVE</span>
                  {s.viewers != null && <span className="absolute bottom-2 left-2 text-[11px] px-2 py-0.5 rounded bg-black/70 text-white">👁 {s.viewers.toLocaleString()}</span>}
                </div>
                <div className="p-3 flex gap-3">
                  <PokerAvatar avatarId={s.profiles?.avatar ?? 'spade'} size={36} />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">{s.title || s.channel}</div>
                    <div className="text-xs text-gray-500 flex items-center gap-1.5 mt-0.5">
                      {s.profiles?.username ?? s.channel}
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${PLATFORM_BADGE[s.platform]}`}>{PLATFORM_LABEL[s.platform]}</span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="mb-8 p-8 text-center bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800">
          <div className="text-3xl mb-2">📺</div>
          <div className="font-semibold text-gray-900 dark:text-white">{t.streamsNoneLive}</div>
          <div className="text-sm text-gray-500 mt-1">{t.streamsNoneLiveHint}</div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* All streamers */}
        <div className="lg:col-span-2">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-3">{t.streamsAll} ({streams.length})</h2>
          {offline.length === 0 && live.length === 0 ? (
            <p className="text-sm text-gray-500">{t.streamsEmpty}</p>
          ) : (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
              {[...live, ...offline].map(s => (
                <div key={s.id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 dark:border-gray-800 last:border-0">
                  <PokerAvatar avatarId={s.profiles?.avatar ?? 'spade'} size={32} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{s.profiles?.username ?? s.channel}</div>
                    <div className="text-xs text-gray-400 truncate">{s.channel}</div>
                  </div>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${PLATFORM_BADGE[s.platform]}`}>{PLATFORM_LABEL[s.platform]}</span>
                  {live.includes(s)
                    ? <span className="text-xs font-bold text-red-600">● LIVE</span>
                    : <span className="text-xs text-gray-400">{t.streamsOffline}</span>}
                  <a href={channelUrl(s)} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-600 hover:underline">↗</a>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add your channel */}
        <div>
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
            <h2 className="font-semibold text-gray-900 dark:text-white">🎥 {t.streamsAddTitle}</h2>
            <p className="text-xs text-gray-500 mt-1 mb-4">{t.streamsAddHint}</p>
            {!token ? (
              <Link href="/auth?mode=login" className="block text-center py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold">{t.streamsLoginToAdd}</Link>
            ) : (
              <>
                {mine.length > 0 && (
                  <div className="mb-4 space-y-2">
                    {mine.map(c => (
                      <div key={c.id} className="flex items-center gap-2 text-sm">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${PLATFORM_BADGE[c.platform]}`}>{PLATFORM_LABEL[c.platform]}</span>
                        <span className="truncate flex-1 text-gray-800 dark:text-gray-200">{c.channel}</span>
                        <span className={`text-[11px] ${c.approved ? 'text-green-600' : 'text-amber-600'}`}>{c.approved ? `✓ ${t.streamsApproved}` : `⏳ ${t.streamsWaiting}`}</span>
                        <button onClick={() => remove(c.platform)} className="text-xs text-red-500 hover:underline">✕</button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 mb-2">
                  {(['twitch', 'youtube'] as Platform[]).map(p => (
                    <button key={p} onClick={() => setPlatform(p)}
                      className={`flex-1 py-1.5 rounded-lg text-sm font-medium border ${platform === p ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'}`}>
                      {PLATFORM_LABEL[p]}
                    </button>
                  ))}
                </div>
                <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && save()}
                  placeholder={platform === 'twitch' ? 'twitch.tv/…' : 'youtube.com/@…'}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white" />
                <button onClick={save} disabled={saving || !input.trim()}
                  className="mt-2 w-full py-2 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-semibold">
                  {saving ? t.loading : t.streamsSave}
                </button>
                {msg && <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">{msg}</p>}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
