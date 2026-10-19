'use client'
import Link from 'next/link'
import { useApp } from '@/contexts/AppContext'
import type { NewsItem } from '@/lib/news'
import { discussHref } from '@/components/NewsList'

/** One news story on its own page. The full article is in Georgian; English shows the summary. */
export default function NewsArticle({ item, body }: { item: NewsItem; body: string | null }) {
  const { t, lang } = useApp()
  const d = new Date(item.published_at)
  const date = `${d.getDate()} ${t.months[d.getMonth()]} ${d.getFullYear()}`
  const paragraphs = lang === 'ka'
    ? (body ?? item.summary_ka).split(/\n\s*\n/).map(p => p.trim()).filter(Boolean)
    : [item.summary_en]

  return (
    <article>
      <Link href="/news" className="text-sm text-gray-500 hover:text-brand-600">{t.newsBack}</Link>
      <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
        <span className="font-semibold text-brand-600">📰 {t.newsTitle}</span>
        <span>·</span>
        <time dateTime={item.published_at}>{date}</time>
      </div>
      <h1 className="mt-2 text-2xl sm:text-3xl font-bold leading-tight text-gray-900 dark:text-white">
        {lang === 'ka' ? item.title_ka : item.title_en}
      </h1>

      <div className="mt-6 space-y-4 text-[15px] sm:text-base leading-relaxed text-gray-700 dark:text-gray-300">
        {paragraphs.map((p, i) => <p key={i}>{p}</p>)}
      </div>
      {lang === 'en' && <p className="mt-3 text-xs text-gray-400">{t.newsEnNote}</p>}

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Link href={discussHref(item, lang)}
          className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold">
          💬 {t.newsDiscuss}
        </Link>
        <Link href="/news" className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300">
          {t.newsMore}
        </Link>
      </div>

      <p className="mt-8 pt-4 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-400">
        {t.newsSourceLabel}:{' '}
        <a href={item.source_url} target="_blank" rel="noopener noreferrer nofollow" className="hover:text-brand-600 underline">{item.source}</a>
      </p>
    </article>
  )
}
