'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useApp } from '@/contexts/AppContext'

type Category = { id: number; name: string }

export default function NewPostPage() {
  const { t } = useApp()
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [categoryId, setCategoryId] = useState<number | ''>('')
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState<any>(null)
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.push('/auth')
      else setUser(data.user)
    })
    supabase.from('categories').select('id, name').then(({ data }) => setCategories(data || []))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !categoryId) return
    setLoading(true)
    const { data, error } = await supabase.from('posts').insert({
      title, content, category_id: categoryId, user_id: user.id
    }).select().single()
    if (!error && data) {
      await supabase.from('categories').update({ post_count: supabase.rpc as any }).eq('id', categoryId)
      router.push(`/post/${data.id}`)
    }
    setLoading(false)
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">{t.writePost}</h1>
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.category}</label>
            <select value={categoryId} onChange={e => setCategoryId(Number(e.target.value))} required
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
              <option value="">{t.selectCategory}</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.title}</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} required placeholder={t.titlePlaceholder}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.content}</label>
            <textarea value={content} onChange={e => setContent(e.target.value)} required rows={8} placeholder={t.contentPlaceholder}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors text-sm">
            {loading ? t.loading : t.submit}
          </button>
        </form>
      </div>
    </div>
  )
}
