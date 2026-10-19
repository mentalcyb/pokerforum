import type { Metadata } from 'next'
import RankingsView from '@/components/RankingsView'
import { GEORGIA_TOP } from '@/data/rankings'

export const metadata: Metadata = {
  title: 'ქართველი პოკერის მოთამაშეების რეიტინგი — TOP 25 | pokerforum.ge',
  description:
    'საქართველოს საუკეთესო პოკერის მოთამაშეები ლაივ ტურნირებში მოგებული თანხის მიხედვით: TOP 25. Georgian poker players ranking by live tournament earnings.',
  keywords: ['ქართველი პოკერის მოთამაშეები', 'პოკერის რეიტინგი', 'georgian poker players', 'georgia poker ranking', 'Hendon Mob Georgia'],
  alternates: { canonical: '/rankings' },
  openGraph: {
    title: 'ქართველი პოკერის მოთამაშეების რეიტინგი — TOP 25',
    description: 'საქართველოს საუკეთესო პოკერის მოთამაშეები ლაივ ტურნირების მოგებით.',
    url: 'https://pokerforum.ge/rankings',
    locale: 'ka_GE',
    type: 'website',
  },
}

export default function RankingsPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Georgian poker players — all-time live earnings TOP 25',
    itemListElement: GEORGIA_TOP.map(p => ({ '@type': 'ListItem', position: p.rank, name: p.name })),
  }
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <RankingsView />
    </div>
  )
}
