import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase-admin'
import { ensureArticle, type NewsItem } from '@/lib/news'
import NewsArticle from '@/components/NewsArticle'

// Articles don't change once written; rebuild hourly at most.
export const revalidate = 3600
// the first visit may write the article (one AI call)
export const maxDuration = 60

async function loadItem(id: string): Promise<(NewsItem & { hasBodyColumn: boolean }) | null> {
  if (!/^\d+$/.test(id)) return null
  try {
    const { data, error } = await createAdminClient()
      .from('news_items').select('*').eq('id', Number(id)).eq('hidden', false).maybeSingle()
    if (error || !data) return null
    // body_ka exists only after supabase/news_articles.sql has been run
    return { ...(data as NewsItem), hasBodyColumn: 'body_ka' in data }
  } catch {
    return null
  }
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const item = await loadItem(params.id)
  if (!item) return { title: 'pokerforum.ge' }
  return {
    title: `${item.title_ka} | pokerforum.ge`,
    description: item.summary_ka.slice(0, 160),
    alternates: { canonical: `/news/${item.id}` },
    openGraph: {
      title: item.title_ka,
      description: item.summary_ka.slice(0, 200),
      url: `https://pokerforum.ge/news/${item.id}`,
      type: 'article',
      locale: 'ka_GE',
      publishedTime: item.published_at,
    },
  }
}

export default async function NewsArticlePage({ params }: { params: { id: string } }) {
  const item = await loadItem(params.id)
  if (!item) notFound()
  // Write the full Georgian article the first time it's opened (only if the column exists,
  // otherwise it couldn't be saved and would be rewritten on every visit).
  // Don't keep the reader waiting too long: after 40s show the summary; the article still gets saved.
  const body = item.hasBodyColumn
    ? await Promise.race([ensureArticle(item), new Promise<null>(r => setTimeout(() => r(null), 40000))])
    : null

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: item.title_ka,
    datePublished: item.published_at,
    inLanguage: 'ka',
    description: item.summary_ka,
    mainEntityOfPage: `https://pokerforum.ge/news/${item.id}`,
    publisher: { '@type': 'Organization', name: 'pokerforum.ge', url: 'https://pokerforum.ge' },
    isBasedOn: item.source_url,
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <NewsArticle item={item} body={body} />
    </div>
  )
}
