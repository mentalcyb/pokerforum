import { createAdminClient } from '@/lib/supabase-admin'

/**
 * Streamers: members link a Twitch or YouTube channel, an admin approves it, and
 * the live status is checked at most every CHECK_SECONDS (cached in the streamers table).
 * Needs TWITCH_CLIENT_ID + TWITCH_CLIENT_SECRET and/or YOUTUBE_API_KEY (both free);
 * a platform without keys is simply shown as offline.
 */

export type Platform = 'twitch' | 'youtube'

export type Streamer = {
  id: number
  user_id: string
  platform: Platform
  channel: string
  approved: boolean
  is_live: boolean
  title: string | null
  viewers: number | null
  thumbnail: string | null
  video_id: string | null
  live_since: string | null
  checked_at: string | null
  created_at: string
  profiles?: { username: string; avatar: string | null } | null
}

const CHECK_SECONDS = 90
const env = (k: string) => process.env[k]?.trim() || ''

// ── parsing what members paste ──────────────────────────────────────────────

/** Turn a pasted link or name into a channel id. Returns null if it doesn't look valid. */
export function parseChannel(platform: Platform, input: string): string | null {
  const s = input.trim()
  if (!s) return null
  if (platform === 'twitch') {
    const m = s.match(/twitch\.tv\/([A-Za-z0-9_]{3,25})/i) ?? s.match(/^@?([A-Za-z0-9_]{3,25})$/)
    const login = m?.[1]?.toLowerCase()
    return login && !['videos', 'directory', 'settings'].includes(login) ? login : null
  }
  const id = s.match(/(UC[A-Za-z0-9_-]{22})/)
  if (id) return id[1]
  const handle = s.match(/youtube\.com\/@([A-Za-z0-9._-]{3,30})/i) ?? s.match(/^@([A-Za-z0-9._-]{3,30})$/)
  return handle ? '@' + handle[1] : null
}

export function channelUrl(platform: Platform, channel: string): string {
  if (platform === 'twitch') return `https://www.twitch.tv/${channel}`
  return channel.startsWith('@') ? `https://www.youtube.com/${channel}` : `https://www.youtube.com/channel/${channel}`
}

// ── Twitch ──────────────────────────────────────────────────────────────────

let twitchToken: { value: string; expires: number } | null = null

async function getTwitchToken(): Promise<string | null> {
  const id = env('TWITCH_CLIENT_ID'), secret = env('TWITCH_CLIENT_SECRET')
  if (!id || !secret) return null
  if (twitchToken && twitchToken.expires > Date.now() + 60_000) return twitchToken.value
  const res = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: id, client_secret: secret, grant_type: 'client_credentials' }),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`twitch token ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const json = await res.json()
  twitchToken = { value: json.access_token, expires: Date.now() + (json.expires_in ?? 3600) * 1000 }
  return twitchToken.value
}

type LiveInfo = { title: string; viewers: number | null; thumbnail: string | null; video_id: string | null; live_since: string | null }

async function checkTwitch(logins: string[]): Promise<Map<string, LiveInfo> | null> {
  if (!logins.length) return new Map()
  const token = await getTwitchToken()
  if (!token) return null
  const live = new Map<string, LiveInfo>()
  for (let i = 0; i < logins.length; i += 100) {
    const qs = logins.slice(i, i + 100).map(l => 'user_login=' + encodeURIComponent(l)).join('&')
    const res = await fetch(`https://api.twitch.tv/helix/streams?first=100&${qs}`, {
      headers: { 'Client-Id': env('TWITCH_CLIENT_ID'), Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    if (!res.ok) throw new Error(`twitch streams ${res.status}: ${(await res.text()).slice(0, 200)}`)
    const json = await res.json()
    for (const s of json.data ?? []) {
      live.set(String(s.user_login).toLowerCase(), {
        title: s.title || '',
        viewers: s.viewer_count ?? null,
        thumbnail: s.thumbnail_url ? String(s.thumbnail_url).replace('{width}', '640').replace('{height}', '360') + `?t=${Date.now()}` : null,
        video_id: null,
        live_since: s.started_at ?? null,
      })
    }
  }
  return live
}

// ── YouTube ─────────────────────────────────────────────────────────────────
// Recent uploads come from the channel's free RSS feed; one videos.list call (1 quota unit
// per 50 videos) then tells which of them is live right now.

async function resolveYoutubeHandle(handle: string, key: string): Promise<string | null> {
  const res = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${encodeURIComponent(handle)}&key=${key}`, { cache: 'no-store' })
  if (!res.ok) return null
  const json = await res.json()
  return json.items?.[0]?.id ?? null
}

async function recentVideoIds(channelId: string): Promise<string[]> {
  try {
    const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`, { cache: 'no-store', signal: AbortSignal.timeout(8000) })
    if (!res.ok) return []
    const xml = await res.text()
    return Array.from(xml.matchAll(/<yt:videoId>([^<]+)<\/yt:videoId>/g)).map(m => m[1]).slice(0, 5)
  } catch {
    return []
  }
}

async function checkYoutube(rows: Streamer[]): Promise<{ live: Map<string, LiveInfo>; resolved: Map<number, string> } | null> {
  const key = env('YOUTUBE_API_KEY')
  if (!key) return null
  const resolved = new Map<number, string>()
  const channelOf = new Map<string, string>() // video id -> channel (as stored)
  await Promise.all(rows.map(async r => {
    let id = r.channel
    if (id.startsWith('@')) {
      const found = await resolveYoutubeHandle(id, key)
      if (!found) return
      resolved.set(r.id, found)
      id = found
    }
    for (const v of await recentVideoIds(id)) channelOf.set(v, resolved.get(r.id) ?? r.channel)
  }))
  const live = new Map<string, LiveInfo>()
  const ids = Array.from(channelOf.keys())
  for (let i = 0; i < ids.length; i += 50) {
    const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,liveStreamingDetails&id=${ids.slice(i, i + 50).join(',')}&key=${key}`, { cache: 'no-store' })
    if (!res.ok) throw new Error(`youtube videos ${res.status}: ${(await res.text()).slice(0, 200)}`)
    const json = await res.json()
    for (const v of json.items ?? []) {
      if (v.snippet?.liveBroadcastContent !== 'live') continue
      const ch = channelOf.get(v.id)
      if (!ch || live.has(ch)) continue
      live.set(ch, {
        title: v.snippet.title || '',
        viewers: v.liveStreamingDetails?.concurrentViewers ? Number(v.liveStreamingDetails.concurrentViewers) : null,
        thumbnail: v.snippet.thumbnails?.high?.url ?? v.snippet.thumbnails?.medium?.url ?? null,
        video_id: v.id,
        live_since: v.liveStreamingDetails?.actualStartTime ?? null,
      })
    }
  }
  return { live, resolved }
}

// ── reading + refreshing ────────────────────────────────────────────────────

const SELECT = '*, profiles(username, avatar)'

/** Approved streamers, live first. Refreshes the live status if it's older than CHECK_SECONDS. */
export async function getStreamers(): Promise<Streamer[]> {
  const admin = createAdminClient()
  const load = async () => {
    const { data, error } = await admin.from('streamers').select(SELECT).eq('approved', true)
    if (error) throw error
    return (data ?? []) as Streamer[]
  }
  let rows = await load()
  const stale = rows.some(r => !r.checked_at || Date.now() - new Date(r.checked_at).getTime() > CHECK_SECONDS * 1000)
  if (stale && rows.length) {
    try {
      await refreshStatus(rows)
      rows = await load()
    } catch (e) {
      console.warn('[streams] status check failed:', e)
    }
  }
  return sortStreamers(rows)
}

export function sortStreamers(rows: Streamer[]): Streamer[] {
  return [...rows].sort((a, b) =>
    Number(b.is_live) - Number(a.is_live) || (b.viewers ?? 0) - (a.viewers ?? 0) ||
    (a.profiles?.username ?? '').localeCompare(b.profiles?.username ?? ''))
}

/** Admin check: re-check every approved channel now and report what each platform answered. */
export async function diagnoseStreams(): Promise<Record<string, unknown>> {
  const admin = createAdminClient()
  const { data } = await admin.from('streamers').select(SELECT).eq('approved', true)
  const rows = (data ?? []) as Streamer[]
  const report: Record<string, unknown> = {
    twitchKeys: !!(env('TWITCH_CLIENT_ID') && env('TWITCH_CLIENT_SECRET')),
    youtubeKey: !!env('YOUTUBE_API_KEY'),
    channels: rows.map(r => `${r.platform}:${r.channel}`),
  }
  const tw = rows.filter(r => r.platform === 'twitch').map(r => r.channel)
  if (tw.length) {
    try {
      twitchToken = null
      const live = await checkTwitch(tw)
      report.twitch = live === null ? 'no keys' : { live: Array.from(live.keys()) }
    } catch (e) { report.twitch = { error: String((e as Error).message ?? e) } }
  }
  const yt = rows.filter(r => r.platform === 'youtube')
  if (yt.length) {
    try {
      const res = await checkYoutube(yt)
      report.youtube = res === null ? 'no key' : { live: Array.from(res.live.keys()) }
    } catch (e) { report.youtube = { error: String((e as Error).message ?? e) } }
  }
  try { await refreshStatus(rows) } catch (e) { report.saveError = String(e) }
  return report
}

async function refreshStatus(rows: Streamer[]) {
  const admin = createAdminClient()
  const now = new Date().toISOString()
  const twitchRows = rows.filter(r => r.platform === 'twitch')
  const ytRows = rows.filter(r => r.platform === 'youtube')
  const [tw, yt] = await Promise.all([
    checkTwitch(twitchRows.map(r => r.channel)).catch(e => { console.warn('[streams] twitch:', e); return null }),
    checkYoutube(ytRows).catch(e => { console.warn('[streams] youtube:', e); return null }),
  ])
  const updates: PromiseLike<unknown>[] = []
  const apply = (r: Streamer, info: LiveInfo | undefined, extra: Record<string, unknown> = {}) => {
    updates.push(admin.from('streamers').update({
      is_live: !!info,
      title: info?.title ?? r.title,
      viewers: info?.viewers ?? null,
      thumbnail: info?.thumbnail ?? null,
      video_id: info?.video_id ?? null,
      live_since: info?.live_since ?? null,
      checked_at: now,
      ...extra,
    }).eq('id', r.id))
  }
  // a platform without keys (null) keeps its rows offline but still marks them checked
  for (const r of twitchRows) apply(r, tw?.get(r.channel))
  for (const r of ytRows) {
    const ch = yt?.resolved.get(r.id) ?? r.channel
    apply(r, yt?.live.get(ch), yt?.resolved.has(r.id) ? { channel: ch } : {})
  }
  await Promise.all(updates)
}

/** The signed-in user (from a Bearer token), or null. */
export async function userFromRequest(req: Request): Promise<{ id: string; isAdmin: boolean } | null> {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) return null
  const admin = createAdminClient()
  const { data: { user } } = await admin.auth.getUser(token)
  if (!user) return null
  const { data: p } = await admin.from('profiles').select('is_admin').eq('id', user.id).single()
  return { id: user.id, isAdmin: !!p?.is_admin }
}
