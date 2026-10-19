import { MetadataRoute } from 'next'
import { createAdminClient } from '@/lib/supabase-admin'

// refresh the list of news pages hourly
export const revalidate = 3600

async function newsEntries(base: string): Promise<MetadataRoute.Sitemap> {
  try {
    const { data } = await createAdminClient()
      .from('news_items').select('id, published_at').eq('hidden', false)
      .order('published_at', { ascending: false }).limit(500)
    return (data ?? []).map((n: { id: number; published_at: string }) => ({
      url: `${base}/news/${n.id}`,
      lastModified: new Date(n.published_at),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    }))
  } catch {
    return []
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = 'https://pokerforum.ge'
  const now = new Date()

  return [
    {
      url: base,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${base}/en`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${base}/en/play-poker-with-friends`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${base}/news`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${base}/tournaments`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${base}/hand-analyzer`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${base}/odds-calculator`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${base}/home-games`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${base}/auth`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    // Category pages
    { url: `${base}/category/1`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${base}/category/2`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${base}/category/3`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${base}/category/4`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${base}/category/5`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${base}/category/6`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    ...(await newsEntries(base)),
  ]
}
