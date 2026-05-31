'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useApp } from '@/contexts/AppContext'
import Link from 'next/link'

const ICON_OPTIONS = ['spade', 'trophy', 'money', 'dice', 'book', 'brain']
const ICON_MAP: Record<string, string> = {
  spade: '♠', trophy: '🏆', money: '💰', dice: '🎲', book: '📚', brain: '🧠'
}

interface UserRow { id: string; username: string; is_admin: boolean; created_at: string }
interface PostRow { id: number; title: string; content: string; created_at: string; profiles: { username: string } | null; categories: { name: string } | null }
interface CategoryRow { id: number; name: string; description: string; icon: string; post_count: number }
interface TournamentRow { id: number; name: string; date: string; buyin: string; status: string }
interface PostEditState { id: number; title: string; content: string }
interface CatEditState { id: number; name: string; description: string; icon: string }
interface NewCatState { name: string; description: string; icon: string }
interface TournamentEditState { id: number; name: string; date: string; buyin: string; status: string }
interface NewTournamentState { name: string; date: string; buyin: string; status: string }

export default function AdminPage() {
  const { t } = useApp()
  const router = useRouter()
  const [users, setUsers] = useState<UserRow[]>([])
  const [posts, setPosts] = useState<PostRow[]>([])
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [tournaments, setTournaments] = useState<TournamentRow[]>([])
  const [tab, setTab] = useState<'posts' | 'users' | 'categories' | 'tournaments'>('posts')
  const [loading, setLoading] = useState(true)
  const [postEditing, setPostEditing] = useState<PostEditState | null>(null)
  const [catEditing, setCatEditing] = useState<CatEditState | null>(null)
  const [newCat, setNewCat] = useState<NewCatState | null>(null)
  const [tournamentEditing, setTournamentEditing] = useState<TournamentEditState | null>(null)
  const [newTournament, setNewTournament] = useState<NewTournamentState | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    checkAdmin()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function checkAdmin() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }
    const { data: profile } = await supabase
      .from('profiles').select('is_admin').eq('id', user.id).single()
    if (!profile?.is_admin) { router.push('/'); return }
    await loadData()
  }

  async function loadData() {
    const [{ data: p }, { data: u }, { data: c }, { data: tr }] = await Promise.all([
      supabase.from('posts').select('id, title, content, created_at, profiles(username), categories(name)').order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, username, is_admin, created_at').order('created_at', { ascending: false }),
      supabase.from('categories').select('*').order('id'),
      supabase.from('tournaments').select('*').order('created_at'),
    ])
    setPosts((p as unknown as PostRow[]) ?? [])
    setUsers((u as unknown as UserRow[]) ?? [])
    setCategories((c as unknown as CategoryRow[]) ?? [])
    setTournaments((tr as unknown as TournamentRow[]) ?? [])
    setLoading(false)
  }

  // --- Posts ---
  async function deletePost(id: number) {
    if (!confirm('პოსტი წაიშლება. დარწმუნებული ხარ?')) return
    setError(null)
    const { error: e1 } = await supabase.from('replies').delete().eq('post_id', id)
    if (e1) { setError(`replies error: ${e1.message}`); return }
    const { error: e2 } = await supabase.from('posts').delete().eq('id', id)
    if (e2) { setError(`post error: ${e2.message}`); return }
    setPosts(prev => prev.filter(p => p.id !== id))
  }

  async function savePostEdit() {
    if (!postEditing) return
    setError(null); setSaving(true)
    const { error: e } = await supabase.from('posts')
      .update({ title: postEditing.title, content: postEditing.content }).eq('id', postEditing.id)
    if (e) { setError(`update error: ${e.message}`); setSaving(false); return }
    setPosts(prev => prev.map(p => p.id === postEditing.id ? { ...p, ...postEditing } : p))
    setPostEditing(null); setSaving(false)
  }

  // --- Categories ---
  async function saveCatEdit() {
    if (!catEditing) return
    setError(null); setSaving(true)
    const { error: e } = await supabase.from('categories')
      .update({ name: catEditing.name, description: catEditing.description, icon: catEditing.icon })
      .eq('id', catEditing.id)
    if (e) { setError(`category update error: ${e.message}`); setSaving(false); return }
    setCategories(prev => prev.map(c => c.id === catEditing.id ? { ...c, ...catEditing } : c))
    setCatEditing(null); setSaving(false)
  }

  async function deleteCategory(id: number) {
    if (!confirm('კატეგორია წაიშლება. ყველა პოსტი დარჩება მაგრამ კატეგორიის გარეშე.')) return
    setError(null)
    const { error: e } = await supabase.from('categories').delete().eq('id', id)
    if (e) { setError(`category delete error: ${e.message}`); return }
    setCategories(prev => prev.filter(c => c.id !== id))
  }

  async function createCategory() {
    if (!newCat || !newCat.name.trim()) return
    setError(null); setSaving(true)
    const { data, error: e } = await supabase.from('categories')
      .insert({ name: newCat.name, description: newCat.description, icon: newCat.icon, post_count: 0 })
      .select().single()
    if (e) { setError(`create error: ${e.message}`); setSaving(false); return }
    setCategories(prev => [...prev, data as unknown as CategoryRow])
    setNewCat(null); setSaving(false)
  }

  // --- Tournaments ---
  async function saveTournamentEdit() {
    if (!tournamentEditing) return
    setError(null); setSaving(true)
    const { error: e } = await supabase.from('tournaments')
      .update({ name: tournamentEditing.name, date: tournamentEditing.date, buyin: tournamentEditing.buyin, status: tournamentEditing.status })
      .eq('id', tournamentEditing.id)
    if (e) { setError(`tournament update error: ${e.message}`); setSaving(false); return }
    setTournaments(prev => prev.map(tr => tr.id === tournamentEditing.id ? { ...tr, ...tournamentEditing } : tr))
    setTournamentEditing(null); setSaving(false)
  }

  async function deleteTournament(id: number) {
    if (!confirm('ტურნირი წაიშლება?')) return
    setError(null)
    const { error: e } = await supabase.from('tournaments').delete().eq('id', id)
    if (e) { setError(`tournament delete error: ${e.message}`); return }
    setTournaments(prev => prev.filter(tr => tr.id !== id))
  }

  async function createTournament() {
    if (!newTournament || !newTournament.name.trim()) return
    setError(null); setSaving(true)
    const { data, error: e } = await supabase.from('tournaments')
      .insert({ name: newTournament.name, date: newTournament.date, buyin: newTournament.buyin, status: newTournament.status })
      .select().single()
    if (e) { setError(`create error: ${e.message}`); setSaving(false); return }
    setTournaments(prev => [...prev, data as unknown as TournamentRow])
    setNewTournament(null); setSaving(false)
  }

  // --- Users ---
  async function toggleAdmin(userId: string, current: boolean) {
    await supabase.from('profiles').update({ is_admin: !current }).eq('id', userId)
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_admin: !current } : u))
  }

  async function deleteUser(userId: string) {
    if (!confirm('მომხმარებელი წაიშლება?')) return
    await supabase.from('posts').delete().eq('user_id', userId)
    await supabase.from('replies').delete().eq('user_id', userId)
    await supabase.from('profiles').delete().eq('id', userId)
    setUsers(prev => prev.filter(u => u.id !== userId))
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen text-gray-400">{t.loading}</div>
  )

  const tabClass = (name: typeof tab) =>
    `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === name ? 'bg-brand-600 text-white' : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'}`

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center text-white text-lg">⚙️</div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">ადმინ პანელი / Admin Panel</h1>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-3 underline text-xs">dismiss</button>
        </div>
      )}

      <div className="flex gap-2 mb-6">
        <button onClick={() => setTab('posts')} className={tabClass('posts')}>პოსტები ({posts.length})</button>
        <button onClick={() => setTab('categories')} className={tabClass('categories')}>კატეგორიები ({categories.length})</button>
        <button onClick={() => setTab('tournaments')} className={tabClass('tournaments')}>ტურნირები ({tournaments.length})</button>
        <button onClick={() => setTab('users')} className={tabClass('users')}>მომხმარებლები ({users.length})</button>
      </div>

      {/* ── POSTS TAB ── */}
      {tab === 'posts' && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          {posts.length === 0
            ? <div className="p-8 text-center text-gray-400">პოსტები არ არის</div>
            : posts.map(post => (
              <div key={post.id} className="border-b border-gray-50 dark:border-gray-800 last:border-0">
                {postEditing?.id === post.id ? (
                  <div className="px-5 py-4 space-y-3">
                    <input value={postEditing.title} onChange={e => setPostEditing({ ...postEditing, title: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                    <textarea value={postEditing.content} onChange={e => setPostEditing({ ...postEditing, content: e.target.value })} rows={5}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none" />
                    <div className="flex gap-2">
                      <button onClick={savePostEdit} disabled={saving} className="px-3 py-1.5 text-xs bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white rounded-lg transition-colors">
                        {saving ? t.loading : '✓ შენახვა'}
                      </button>
                      <button onClick={() => setPostEditing(null)} className="px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                        გაუქმება
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-4 px-5 py-4">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-brand-600 mb-0.5">{post.categories?.name}</div>
                      <Link href={`/post/${post.id}`} className="text-sm font-medium text-gray-900 dark:text-white hover:text-brand-600 truncate block">{post.title}</Link>
                      <div className="text-xs text-gray-400 mt-0.5">{post.profiles?.username}</div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button onClick={() => setPostEditing({ id: post.id, title: post.title, content: post.content })}
                        className="px-3 py-1.5 text-xs bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-blue-600 hover:bg-blue-100 transition-colors">
                        ✏️ რედაქტირება
                      </button>
                      <button onClick={() => deletePost(post.id)}
                        className="px-3 py-1.5 text-xs bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 hover:bg-red-100 transition-colors">
                        🗑️ წაშლა
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          }
        </div>
      )}

      {/* ── CATEGORIES TAB ── */}
      {tab === 'categories' && (
        <div className="space-y-4">
          {/* Create new category */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <h2 className="font-medium text-gray-900 dark:text-white text-sm">კატეგორიები</h2>
              {!newCat && (
                <button
                  onClick={() => setNewCat({ name: '', description: '', icon: 'spade' })}
                  className="px-3 py-1.5 text-xs bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors"
                >
                  + ახალი კატეგორია
                </button>
              )}
            </div>

            {newCat && (
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 bg-brand-50 dark:bg-brand-900/10 space-y-3">
                <div className="text-xs font-medium text-brand-700 dark:text-brand-400 mb-2">ახალი კატეგორია</div>
                <input
                  value={newCat.name}
                  onChange={e => setNewCat({ ...newCat, name: e.target.value })}
                  placeholder="სახელი"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <input
                  value={newCat.description}
                  onChange={e => setNewCat({ ...newCat, description: e.target.value })}
                  placeholder="აღწერა"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">ხატულა:</span>
                  {ICON_OPTIONS.map(icon => (
                    <button key={icon} onClick={() => setNewCat({ ...newCat, icon })}
                      className={`w-8 h-8 rounded-lg text-base transition-colors ${newCat.icon === icon ? 'bg-brand-600 text-white' : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
                      {ICON_MAP[icon]}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button onClick={createCategory} disabled={saving || !newCat.name.trim()}
                    className="px-3 py-1.5 text-xs bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white rounded-lg transition-colors">
                    {saving ? t.loading : '+ შექმნა'}
                  </button>
                  <button onClick={() => setNewCat(null)}
                    className="px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-50 transition-colors">
                    გაუქმება
                  </button>
                </div>
              </div>
            )}

            {categories.length === 0
              ? <div className="p-8 text-center text-gray-400">კატეგორიები არ არის</div>
              : categories.map(cat => (
                <div key={cat.id} className="border-b border-gray-50 dark:border-gray-800 last:border-0">
                  {catEditing?.id === cat.id ? (
                    <div className="px-5 py-4 space-y-3">
                      <input value={catEditing.name} onChange={e => setCatEditing({ ...catEditing, name: e.target.value })}
                        placeholder="სახელი"
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                      <input value={catEditing.description} onChange={e => setCatEditing({ ...catEditing, description: e.target.value })}
                        placeholder="აღწერა"
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">ხატულა:</span>
                        {ICON_OPTIONS.map(icon => (
                          <button key={icon} onClick={() => setCatEditing({ ...catEditing, icon })}
                            className={`w-8 h-8 rounded-lg text-base transition-colors ${catEditing.icon === icon ? 'bg-brand-600 text-white' : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
                            {ICON_MAP[icon]}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={saveCatEdit} disabled={saving}
                          className="px-3 py-1.5 text-xs bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white rounded-lg transition-colors">
                          {saving ? t.loading : '✓ შენახვა'}
                        </button>
                        <button onClick={() => setCatEditing(null)}
                          className="px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                          გაუქმება
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-4 px-5 py-4">
                      <div className="w-9 h-9 bg-brand-50 dark:bg-brand-900/30 rounded-xl flex items-center justify-center text-xl flex-shrink-0">
                        {ICON_MAP[cat.icon] || '♠'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">{cat.name}</div>
                        <div className="text-xs text-gray-400 truncate mt-0.5">{cat.description}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{cat.post_count} პოსტი</div>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={() => setCatEditing({ id: cat.id, name: cat.name, description: cat.description, icon: cat.icon })}
                          className="px-3 py-1.5 text-xs bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-blue-600 hover:bg-blue-100 transition-colors">
                          ✏️ რედაქტირება
                        </button>
                        <button onClick={() => deleteCategory(cat.id)}
                          className="px-3 py-1.5 text-xs bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 hover:bg-red-100 transition-colors">
                          🗑️ წაშლა
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            }
          </div>
        </div>
      )}

      {/* ── TOURNAMENTS TAB ── */}
      {tab === 'tournaments' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <h2 className="font-medium text-gray-900 dark:text-white text-sm">ტურნირები</h2>
              {!newTournament && (
                <button
                  onClick={() => setNewTournament({ name: '', date: '', buyin: '', status: 'open' })}
                  className="px-3 py-1.5 text-xs bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors"
                >
                  + ახალი ტურნირი
                </button>
              )}
            </div>

            {newTournament && (
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 bg-brand-50 dark:bg-brand-900/10 space-y-3">
                <div className="text-xs font-medium text-brand-700 dark:text-brand-400 mb-2">ახალი ტურნირი</div>
                <input value={newTournament.name} onChange={e => setNewTournament({ ...newTournament, name: e.target.value })}
                  placeholder="სახელი (მაგ. TPC Monthly)"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                <div className="grid grid-cols-2 gap-3">
                  <input value={newTournament.date} onChange={e => setNewTournament({ ...newTournament, date: e.target.value })}
                    placeholder="თარიღი (მაგ. 1 ივნისი)"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                  <input value={newTournament.buyin} onChange={e => setNewTournament({ ...newTournament, buyin: e.target.value })}
                    placeholder="Buy-in (მაგ. ₾200)"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
                <select value={newTournament.status} onChange={e => setNewTournament({ ...newTournament, status: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                  <option value="open">open</option>
                  <option value="online">online</option>
                  <option value="soon">soon</option>
                  <option value="closed">closed</option>
                </select>
                <div className="flex gap-2">
                  <button onClick={createTournament} disabled={saving || !newTournament.name.trim()}
                    className="px-3 py-1.5 text-xs bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white rounded-lg transition-colors">
                    {saving ? t.loading : '+ შექმნა'}
                  </button>
                  <button onClick={() => setNewTournament(null)}
                    className="px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-50 transition-colors">
                    გაუქმება
                  </button>
                </div>
              </div>
            )}

            {tournaments.length === 0
              ? <div className="p-8 text-center text-gray-400">ტურნირები არ არის</div>
              : tournaments.map(tr => (
                <div key={tr.id} className="border-b border-gray-50 dark:border-gray-800 last:border-0">
                  {tournamentEditing?.id === tr.id ? (
                    <div className="px-5 py-4 space-y-3">
                      <input value={tournamentEditing.name} onChange={e => setTournamentEditing({ ...tournamentEditing, name: e.target.value })}
                        placeholder="სახელი"
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                      <div className="grid grid-cols-2 gap-3">
                        <input value={tournamentEditing.date} onChange={e => setTournamentEditing({ ...tournamentEditing, date: e.target.value })}
                          placeholder="თარიღი"
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                        <input value={tournamentEditing.buyin} onChange={e => setTournamentEditing({ ...tournamentEditing, buyin: e.target.value })}
                          placeholder="Buy-in"
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                      </div>
                      <select value={tournamentEditing.status} onChange={e => setTournamentEditing({ ...tournamentEditing, status: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                        <option value="open">open</option>
                        <option value="online">online</option>
                        <option value="soon">soon</option>
                        <option value="closed">closed</option>
                      </select>
                      <div className="flex gap-2">
                        <button onClick={saveTournamentEdit} disabled={saving}
                          className="px-3 py-1.5 text-xs bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white rounded-lg transition-colors">
                          {saving ? t.loading : '✓ შენახვა'}
                        </button>
                        <button onClick={() => setTournamentEditing(null)}
                          className="px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                          გაუქმება
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-4 px-5 py-4">
                      <div className="text-2xl flex-shrink-0">🏆</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">{tr.name}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{tr.date} · {tr.buyin}</div>
                        <div className="text-xs mt-0.5">
                          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${tr.status === 'open' ? 'bg-green-100 text-green-700' : tr.status === 'online' ? 'bg-blue-100 text-blue-700' : tr.status === 'soon' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                            {tr.status}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={() => setTournamentEditing({ id: tr.id, name: tr.name, date: tr.date, buyin: tr.buyin, status: tr.status })}
                          className="px-3 py-1.5 text-xs bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-blue-600 hover:bg-blue-100 transition-colors">
                          ✏️ რედაქტირება
                        </button>
                        <button onClick={() => deleteTournament(tr.id)}
                          className="px-3 py-1.5 text-xs bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 hover:bg-red-100 transition-colors">
                          🗑️ წაშლა
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            }
          </div>
        </div>
      )}

      {/* ── USERS TAB ── */}
      {tab === 'users' && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          {users.length === 0
            ? <div className="p-8 text-center text-gray-400">მომხმარებლები არ არიან</div>
            : users.map(user => (
              <div key={user.id} className="flex items-center gap-4 px-5 py-4 border-b border-gray-50 dark:border-gray-800 last:border-0">
                <div className="w-9 h-9 bg-brand-100 dark:bg-brand-900/40 rounded-full flex items-center justify-center text-brand-700 dark:text-brand-400 text-sm font-bold flex-shrink-0">
                  {user.username?.[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{user.username}</span>
                    {user.is_admin && (
                      <span className="px-1.5 py-0.5 text-xs bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-400 rounded">ადმინი</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">{new Date(user.created_at).toLocaleDateString()}</div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => toggleAdmin(user.id, user.is_admin)}
                    className={`px-3 py-1.5 text-xs border rounded-lg transition-colors ${user.is_admin ? 'border-amber-200 text-amber-600 hover:bg-amber-50' : 'border-brand-200 text-brand-600 hover:bg-brand-50'}`}>
                    {user.is_admin ? '👑 მოხსნა' : '👑 ადმინი'}
                  </button>
                  <button onClick={() => deleteUser(user.id)}
                    className="px-3 py-1.5 text-xs bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 hover:bg-red-100 transition-colors">
                    🗑️ წაშლა
                  </button>
                </div>
              </div>
            ))
          }
        </div>
      )}
    </div>
  )
}
