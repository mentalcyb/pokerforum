import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/api/', '/profile', '/inbox'],
    },
    sitemap: 'https://pokerforum.ge/sitemap.xml',
  }
}
