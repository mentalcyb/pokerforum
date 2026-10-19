'use client'
import { useApp } from '@/contexts/AppContext'

export default function NewsHeader() {
  const { t } = useApp()
  return (
    <div className="flex items-center gap-3 mb-6">
      <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center text-white text-xl">📰</div>
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t.newsTitle}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">{t.newsSubtitle}</p>
      </div>
    </div>
  )
}
