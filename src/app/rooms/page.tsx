import type { Metadata } from 'next'
import RoomsView from '@/components/RoomsView'

export const metadata: Metadata = {
  title: 'სად თამაშობენ ქართველები? ონლაინ პოკერ რუმები | pokerforum.ge',
  description: 'ქართველი მოთამაშეების ტოპ ონლაინ პოკერ რუმები — GGPoker, PokerStars, CoinPoker, ACR და სხვა. მიეცი ხმა და ნახე, სად თამაშობენ სხვები.',
  keywords: ['პოკერ რუმები', 'ონლაინ პოკერი', 'GGPoker საქართველო', 'PokerStars საქართველო', 'best poker rooms georgia'],
  alternates: { canonical: '/rooms' },
  openGraph: {
    title: 'სად თამაშობენ ქართველები? | pokerforum.ge',
    description: 'ქართველი მოთამაშეების ტოპ ონლაინ პოკერ რუმები.',
    url: 'https://pokerforum.ge/rooms',
    locale: 'ka_GE',
    type: 'website',
  },
}

export default function RoomsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <RoomsView />
    </div>
  )
}
