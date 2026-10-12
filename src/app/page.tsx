import type { Metadata } from 'next'
import HomePage from '@/components/HomeClient'

export const metadata: Metadata = {
  alternates: {
    canonical: '/',
    // the English landing page is the English version of the homepage
    languages: { ka: '/', en: '/en', 'x-default': '/' },
  },
}

export default function Page() {
  return <HomePage />
}
