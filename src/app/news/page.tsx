import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase-admin'
import { updateNews, type NewsItem } from '@/lib/news'
import NewsList from '@/components/NewsList'
import NewsHeader from '@/components/NewsHeader'

// Rebuilt at most every 10 minutes; the daily update also refreshes it right away.
export const revalidate = 600
// allow time for a catch-up update (feeds + one AI call)
export const maxDuration = 60

/** If there's no news yet, or the newest is older than this, fetch new stories now. */
const STALE_HOURS = 20

export const metadata: Metadata = {
  title: 'პოკერის სიახლეები ქართულად — ყოველდღიურად | pokerforum.ge',
  description:
    'პოკერის მსოფლიო სიახლეები ქართულ ენაზე: ტურნირების შედეგები, WSOP, EPT, WPT, ონლაინ პოკერი. ახლდება ყოველდღე, წყაროს ბმულებით.',
  keywords: ['პოკერის სიახლეები', 'პოკერი სიახლეები ქართულად', 'poker news georgian', 'WSOP', 'EPT', 'პოკერის ტურნირები'],
  alternates: { canonical: '/news' },
  openGraph: {
    title: 'პოკერის სიახლეები ქართულად | pokerforum.ge',
    description: 'მსოფლიო პოკერის სიახლეები ქართულ ენაზე, ყოველდღე.',
    url: 'https://pokerforum.ge/news',
    locale: 'ka_GE',
    type: 'website',
  },
}

async function loadNews(): Promise<NewsItem[]> {
  try {
    const { data, error } = await createAdminClient()
      .from('news_items')
      .select('id, source, source_url, title_en, title_ka, summary_ka, summary_en, published_at')
      .eq('hidden', false)
      .order('published_at', { ascending: false })
      .limit(60)
    if (error) throw error
    return (data ?? []) as NewsItem[]
  } catch (e) {
    // table not created yet (supabase/news.sql) — show the empty state
    console.warn('[news] load failed:', e)
    return []
  }
}

export default async function NewsPage() {
  let items = await loadNews()
  // Self-healing: no admin needed for the first stories, and a missed daily run is caught up.
  // Runs at most once per page rebuild (every 10 min), and only when news is missing or stale.
  const newest = items[0] ? new Date(items[0].published_at).getTime() : 0
  if (Date.now() - newest > STALE_HOURS * 3600_000) {
    try {
      const result = await updateNews()
      if (result.added > 0) items = await loadNews()
      if (result.error) console.warn('[news] catch-up update:', result.error)
    } catch (e) {
      console.warn('[news] catch-up update failed:', e)
    }
  }
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <NewsHeader />
      <NewsList items={items} />
    </div>
  )
}
