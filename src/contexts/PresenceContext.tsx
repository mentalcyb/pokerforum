'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

/**
 * Live "who is on the site right now", via Supabase Realtime Presence (no database table).
 * Every open tab joins one channel: signed-in visitors with their user id, visitors without
 * an account with a random guest id kept in their browser. Counts are unique visitors,
 * so several tabs of the same person count once.
 */
type Presence = { guests: number; members: number; ready: boolean }

const PresenceContext = createContext<Presence>({ guests: 0, members: 0, ready: false })

const GUEST_KEY = 'pf-guest-id'

function guestId(): string {
  try {
    let id = localStorage.getItem(GUEST_KEY)
    if (!id) {
      id = `g-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`
      localStorage.setItem(GUEST_KEY, id)
    }
    return id
  } catch {
    // storage blocked (private mode): a per-tab id still counts this visitor once
    return `g-${Math.random().toString(36).slice(2, 12)}`
  }
}

export function PresenceProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<Presence>({ guests: 0, members: 0, ready: false })

  useEffect(() => {
    const supabase = createClient()
    let channel: ReturnType<typeof supabase.channel> | null = null
    let cancelled = false

    const recount = () => {
      if (!channel) return
      const all = channel.presenceState() as Record<string, { kind?: string }[]>
      let guests = 0
      let members = 0
      for (const metas of Object.values(all)) {
        if (metas[0]?.kind === 'member') members++
        else guests++
      }
      setState({ guests, members, ready: true })
    }

    async function join(userId: string | null) {
      if (channel) { await supabase.removeChannel(channel); channel = null }
      if (cancelled) return
      const key = userId ?? guestId()
      channel = supabase.channel('site-presence', { config: { presence: { key } } })
      channel
        .on('presence', { event: 'sync' }, recount)
        .subscribe(async status => {
          if (status === 'SUBSCRIBED') await channel?.track({ kind: userId ? 'member' : 'guest' })
        })
    }

    supabase.auth.getSession().then(({ data }) => join(data.session?.user.id ?? null))
    // logging in or out switches between guest and member
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') join(session?.user.id ?? null)
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
      if (channel) supabase.removeChannel(channel)
    }
  }, [])

  return <PresenceContext.Provider value={state}>{children}</PresenceContext.Provider>
}

export function usePresence() {
  return useContext(PresenceContext)
}
