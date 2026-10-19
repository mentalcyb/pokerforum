import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase-admin'
import type { NewsItem } from '@/lib/news'
import NewsList from '@/components/NewsList'
import NewsHeader from '@/components/NewsHeader'

// Rebuilt at most every 10 minutes; the daily update also refreshes it right away.
export const revalidate = 600

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
  const items = await loadNews()
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <NewsHeader />
      <NewsList items={items} />
    </div>
  )
}
