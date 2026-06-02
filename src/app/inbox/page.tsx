'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useApp } from '@/contexts/AppContext'
import Link from 'next/link'
import PokerAvatar from '@/components/PokerAvatar'

interface Message {
  id: number
  content: string
  read: boolean
  created_at: string
  sender_id: string
  receiver_id: string
  sender: { username: string; avatar: string | null } | null
  receiver: { username: string; avatar: string | null } | null
}

// Group messages into conversations by the other participant
interface Conversation {
  otherUserId: string
  otherUsername: string
  otherAvatar: string | null
  messages: Message[]
  unread: number
  lastMessage: Message
}

export default function InboxPage() {
  const { t } = useApp()
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selected, setSelected] = useState<Conversation | null>(null)
  const [replyText, setReplyText] = useState('')
  const [replySending, setReplySending] = useState(false)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth'); return }
      setUserId(user.id)
      await loadMessages(user.id)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadMessages(uid: string) {
    const { data } = await supabase
      .from('messages')
      .select(`
        id, content, read, created_at, sender_id, receiver_id,
        sender:profiles!messages_sender_id_fkey(username, avatar),
        receiver:profiles!messages_receiver_id_fkey(username, avatar)
      `)
      .or(`sender_id.eq.${uid},receiver_id.eq.${uid}`)
      .order('created_at', { ascending: true })

    if (!data) { setLoading(false); return }

    // Build conversation map keyed by the other user's ID
    const map = new Map<string, Conversation>()
    for (const msg of data as unknown as Message[]) {
      const isIncoming = msg.receiver_id === uid
      const otherId = isIncoming ? msg.sender_id : msg.receiver_id
      const otherProfile = isIncoming ? msg.sender : msg.receiver

      if (!map.has(otherId)) {
        map.set(otherId, {
          otherUserId: otherId,
          otherUsername: otherProfile?.username ?? 'unknown',
          otherAvatar: otherProfile?.avatar ?? null,
          messages: [],
          unread: 0,
          lastMessage: msg,
        })
      }
      const conv = map.get(otherId)!
      conv.messages.push(msg)
      conv.lastMessage = msg
      if (isIncoming && !msg.read) conv.unread++
    }

    const sorted = Array.from(map.values()).sort(
      (a, b) => new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime()
    )
    setConversations(sorted)
    setLoading(false)
  }

  async function openConversation(conv: Conversation) {
    setSelected(conv)
    setReplyText('')
    if (!userId) return

    // Mark unread messages as read
    const unreadIds = conv.messages
      .filter(m => m.receiver_id === userId && !m.read)
      .map(m => m.id)
    if (unreadIds.length > 0) {
      await supabase.from('messages').update({ read: true }).in('id', unreadIds)
      setConversations(prev => prev.map(c =>
        c.otherUserId === conv.otherUserId ? { ...c, unread: 0 } : c
      ))
    }
  }

  async function sendReply(e: React.FormEvent) {
    e.preventDefault()
    if (!userId || !selected || !replyText.trim()) return
    setReplySending(true)
    const { data, error } = await supabase.from('messages').insert({
      sender_id: userId,
      receiver_id: selected.otherUserId,
      content: replyText.trim(),
    }).select(`
      id, content, read, created_at, sender_id, receiver_id,
      sender:profiles!messages_sender_id_fkey(username, avatar),
      receiver:profiles!messages_receiver_id_fkey(username, avatar)
    `).single()

    if (!error && data) {
      const newMsg = data as unknown as Message
      setSelected(prev => prev ? { ...prev, messages: [...prev.messages, newMsg], lastMessage: newMsg } : prev)
      setConversations(prev => prev.map(c =>
        c.otherUserId === selected.otherUserId
          ? { ...c, messages: [...c.messages, newMsg], lastMessage: newMsg }
          : c
      ))
      setReplyText('')
    }
    setReplySending(false)
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins} ${t.min} ${t.ago}`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs} ${t.hr} ${t.ago}`
    return `${Math.floor(hrs / 24)} ${t.day} ${t.ago}`
  }

  if (loading) return <div className="flex items-center justify-center min-h-screen text-gray-400">{t.loading}</div>

  const totalUnread = conversations.reduce((s, c) => s + c.unread, 0)

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link href="/" className="text-brand-600 text-sm hover:underline mb-4 block">← {t.home}</Link>

      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">📬 {t.inbox}</h1>
        {totalUnread > 0 && (
          <span className="px-2 py-0.5 text-xs font-bold bg-brand-600 text-white rounded-full">{totalUnread}</span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Conversation list */}
        <div className="md:col-span-1 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          {conversations.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">{t.noMessages}</div>
          ) : conversations.map(conv => (
            <button
              key={conv.otherUserId}
              onClick={() => openConversation(conv)}
              className={`w-full flex items-center gap-3 px-4 py-3 border-b border-gray-50 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left ${selected?.otherUserId === conv.otherUserId ? 'bg-brand-50 dark:bg-brand-900/20' : ''}`}
            >
              <div className="relative flex-shrink-0">
                <PokerAvatar avatarId={conv.otherAvatar} size={36} />
                {conv.unread > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-brand-600 text-white text-xs rounded-full flex items-center justify-center font-bold">{conv.unread}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className={`text-sm truncate ${conv.unread > 0 ? 'font-bold text-gray-900 dark:text-white' : 'font-medium text-gray-700 dark:text-gray-300'}`}>
                  {conv.otherUsername}
                </div>
                <div className="text-xs text-gray-400 truncate">{conv.lastMessage.content}</div>
              </div>
              <div className="text-xs text-gray-400 flex-shrink-0">{timeAgo(conv.lastMessage.created_at)}</div>
            </button>
          ))}
        </div>

        {/* Message thread */}
        <div className="md:col-span-2 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 flex flex-col">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center p-8 text-gray-400 text-sm">
              {conversations.length === 0 ? t.noMessages : t.conversation + '...'}
            </div>
          ) : (
            <>
              {/* Thread header */}
              <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 dark:border-gray-800">
                <PokerAvatar avatarId={selected.otherAvatar} size={32} />
                <Link href={`/user/${encodeURIComponent(selected.otherUsername)}`} className="font-semibold text-gray-900 dark:text-white text-sm hover:text-brand-600 transition-colors">
                  {selected.otherUsername}
                </Link>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-96">
                {selected.messages.map(msg => {
                  const isMine = msg.sender_id === userId
                  return (
                    <div key={msg.id} className={`flex gap-2 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
                      <PokerAvatar
                        avatarId={isMine ? null : selected.otherAvatar}
                        size={28}
                        className="flex-shrink-0 self-end"
                      />
                      <div className={`max-w-xs lg:max-w-sm px-3 py-2 rounded-2xl text-sm ${
                        isMine
                          ? 'bg-brand-600 text-white rounded-br-sm'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-bl-sm'
                      }`}>
                        <p>{msg.content}</p>
                        <p className={`text-xs mt-1 ${isMine ? 'text-brand-200' : 'text-gray-400'}`}>
                          {timeAgo(msg.created_at)}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Reply form */}
              <div className="p-4 border-t border-gray-100 dark:border-gray-800">
                <form onSubmit={sendReply} className="flex gap-2">
                  <input
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    placeholder={t.messagePlaceholder}
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  <button type="submit" disabled={replySending || !replyText.trim()}
                    className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
                    {replySending ? '...' : '➤'}
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
