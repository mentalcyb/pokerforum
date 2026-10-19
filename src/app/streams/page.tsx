import type { Metadata } from 'next'
import { getStreamers, type Streamer } from '@/lib/streams'
import StreamsView from '@/components/StreamsView'

// live status is re-checked at most every ~90s; the page is rebuilt every minute
export const revalidate = 60
export const maxDuration = 30

export const metadata: Metadata = {
  title: 'პოკერის სტრიმები ლაივში — ქართველი სტრიმერები | pokerforum.ge',
  description: 'ქართველი პოკერის სტრიმერები Twitch-სა და YouTube-ზე: ნახე, ვინ არის ახლა ლაივში და უყურე პირდაპირ pokerforum.ge-ზე.',
  keywords: ['პოკერის სტრიმები', 'პოკერი ლაივში', 'ქართველი სტრიმერები', 'georgian poker streamers', 'poker twitch georgia'],
  alternates: { canonical: '/streams' },
  openGraph: {
    title: 'პოკერის სტრიმები ლაივში | pokerforum.ge',
    description: 'ქართველი პოკერის სტრიმერები — ვინ არის ახლა ლაივში.',
    url: 'https://pokerforum.ge/streams',
    locale: 'ka_GE',
    type: 'website',
  },
}

export default async function StreamsPage() {
  let streams: Streamer[] = []
  try {
    streams = await getStreamers()
  } catch (e) {
    // table not created yet (supabase/streams.sql)
    console.warn('[streams] load failed:', e)
  }
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <StreamsView streams={streams} />
    </div>
  )
}
