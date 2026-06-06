import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
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
  ]
}
