'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useApp } from '@/contexts/AppContext'
import Link from 'next/link'

type User = { id: string; username: string; is_admin: boolean; created_at: string }
type Post = { id: number; title: string; created_at: string; profiles: { username: string }; categories: { name: string } }

export default function AdminPage() {
  const { t } = useApp()
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [posts, setPosts] = useState<Post[]>([])
  const [tab, setTab] = useState<'posts' | 'users'>('posts')
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => { checkAdmin() }, [])

  async function checkAdmin() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }
    const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
    if (!profile?.is_admin) { router.push('/'); return }
    loadData()
  }

  async function loadData() {
    const [{ data: p }, { data: u }] = await Promise.all([
      supabase.from('posts').select('id, title, created_at, profiles(username), categories(name)').order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, username, is_admin, created_at').order('created_at', { ascending: false })
    ])
    setPosts((p as any) || [])
    setUsers(u || [])
    setLoading(false)
  }

  async function deletePost(id: number) {
    if (!confirm('პოსტი წაიშლება. დარწმუნებული ხარ?')) return
    await supabase.from('replies').delete().eq('post_id', id)
    await supabase.from('posts').delete().eq('id', id)
    setPosts(posts.filter(p => p.id !== id))
  }

  async function toggleAdmin(userId: string, current: boolean) {
    await supabase.from('profiles').update({ is_admin: !current }).eq('id', userId)
    setUsers(users.map(u => u.id === userId ? { ...u, is_admin: !current } : u))
  }

  async function deleteUser(userId: string) {
    if (!confirm('მომხმარებელი წაიშლება?')) return
    await supabase.from('posts').delete().eq('user_id', userId)
    await supabase.from('replies').delete().eq('user_id', userId)
    await supabase.from('profiles').delete().eq('id', userId)
    setUsers(users.filter(u => u.id !== userId))
  }

  if (loading) return <div className="flex items-center justify-center min-h-screen text-gray-400">{t.loading}</div>

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center text-white text-lg">⚙️</div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">ადმინ პანელი / Admin Panel</h1>
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        <button onClick={() => setTab('posts')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'posts' ? 'bg-brand-600 text-white' : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'}`}>
          პოსტები ({posts.length})
        </button>
        <button onClick={() => setTab('users')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'users' ? 'bg-brand-600 text-white' : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'}`}>
          მომხმარებლები ({users.length})
        </button>
      </div>

      {tab === 'posts' && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          {posts.length === 0 ? <div className="p-8 text-center text-gray-400">პოსტები არ არის</div>
          : posts.map(post => (
            <div key={post.id} className="flex items-center gap-4 px-5 py-4 border-b border-gray-50 dark:border-gray-800 last:border-0">
              <div className="flex-1 min-w-0">
                <div className="text-xs text-brand-600 mb-0.5">{(post.categories as any)?.name}</div>
                <Link href={`/post/${post.id}`} className="text-sm font-medium text-gray-900 dark:text-white hover:text-brand-600 truncate block">{post.title}</Link>
                <div className="text-xs text-gray-400 mt-0.5">{(post.profiles as any)?.username}</div>
              </div>
              <button onClick={() => deletePost(post.id)} className="px-3 py-1.5 text-xs bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 hover:bg-red-100 transition-colors flex-shrink-0">
                🗑️ წაშლა
              </button>
            </div>
          ))}
        </div>
      )}

      {tab === 'users' && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          {users.length === 0 ? <div className="p-8 text-center text-gray-400">მომხმარებლები არ არიან</div>
          : users.map(user => (
            <div key={user.id} className="flex items-center gap-4 px-5 py-4 border-b border-gray-50 dark:border-gray-800 last:border-0">
              <div className="w-9 h-9 bg-brand-100 dark:bg-brand-900/40 rounded-full flex items-center justify-center text-brand-700 dark:text-brand-400 text-sm font-bold flex-shrink-0">
                {user.username?.[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{user.username}</span>
                  {user.is_admin && <span className="px-1.5 py-0.5 text-xs bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-400 rounded">ადმინი</span>}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">{new Date(user.created_at).toLocaleDateString()}</div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={() => toggleAdmin(user.id, user.is_admin)} className={`px-3 py-1.5 text-xs border rounded-lg transition-colors ${user.is_admin ? 'border-amber-200 text-amber-600 hover:bg-amber-50' : 'border-brand-200 text-brand-600 hover:bg-brand-50'}`}>
                  {user.is_admin ? '👑 მოხსნა' : '👑 ადმინი'}
                </button>
                <button onClick={() => deleteUser(user.id)} className="px-3 py-1.5 text-xs bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 hover:bg-red-100 transition-colors">
                  🗑️ წაშლა
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
