import type { Metadata } from 'next'
import Link from 'next/link'
import SetLanguage from '@/components/SetLanguage'
import { flagUrl, formatDates, upcomingTournaments } from '@/data/tournaments'

// Re-render hourly so the tournament list stays current
export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Georgian Poker Forum — Poker in Georgia, Tournaments & Free Games | pokerforum.ge',
  description:
    'pokerforum.ge is the Georgian poker community: strategy discussions, live tournaments near Tbilisi and Batumi, free poker with friends in your browser, and an odds calculator. Available in English and Georgian.',
  keywords: [
    'georgian poker forum', 'poker forum georgia', 'poker in georgia', 'poker tbilisi', 'poker batumi',
    'georgia poker community', 'poker tournaments near georgia', 'play poker with friends', 'pokerforum.ge',
  ],
  alternates: {
    canonical: '/en',
    languages: { ka: '/', en: '/en', 'x-default': '/' },
  },
  openGraph: {
    title: 'Georgian Poker Forum — pokerforum.ge',
    description: 'The Georgian poker community: forum, tournaments near Georgia and free poker with friends.',
    url: 'https://pokerforum.ge/en',
    locale: 'en_US',
    alternateLocale: ['ka_GE'],
    type: 'website',
  },
}

const FAQ = [
  {
    q: 'What is pokerforum.ge?',
    a: 'The online home of the Georgian poker community: a forum for strategy, hand discussions and news, a calendar of tournaments within easy reach of Georgia, free poker tables for friends and handy tools like an odds calculator.',
  },
  {
    q: 'Is the site available in English?',
    a: 'Yes. The whole interface switches to English with one click (the language button at the top). Many discussions are in Georgian, and English posts are very welcome.',
  },
  {
    q: 'Can I play poker with friends here?',
    a: 'Yes — create a private table, send the invite link to your friends and play Texas Hold\'em in the browser. Cash games and Sit & Go tournaments, up to 9 players. It\'s free and uses play chips only — no real money.',
  },
  {
    q: 'Where can I play live poker near Georgia?',
    a: 'Our tournament page lists upcoming live series that are a short flight from Tbilisi, with dates and buy-ins taken from the official announcements. Finished events drop off automatically.',
  },
]

export default function EnglishHome() {
  const upcoming = upcomingTournaments().slice(0, 5)
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'pokerforum.ge',
      alternateName: ['Georgian Poker Forum', 'Poker Forum Georgia', 'პოკერის ფორუმი'],
      url: 'https://pokerforum.ge/',
      inLanguage: ['ka', 'en'],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: FAQ.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    },
  ]

  const card = 'block bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 hover:border-brand-400 transition-colors'

  return (
    <div className="max-w-4xl mx-auto px-4 py-8" lang="en">
      <SetLanguage lang="en" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <header className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">Georgian Poker Forum</h1>
        <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
          <strong>pokerforum.ge</strong> is where poker players in Georgia meet: talk strategy, share hands, find live
          tournaments near Tbilisi and Batumi, and play free poker with friends right in the browser.
          Visiting Georgia or playing from abroad? You&apos;re welcome here — the site works fully in English.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 mb-10">
        <Link href="/en/play-poker-with-friends" className={card}>
          <div className="text-2xl mb-1">🃏</div>
          <h2 className="font-semibold text-gray-900 dark:text-white">Play poker with friends</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Private Hold&apos;em tables — cash games or Sit &amp; Go tournaments. Free, play chips only.</p>
        </Link>
        <Link href="/?lang=en" className={card}>
          <div className="text-2xl mb-1">💬</div>
          <h2 className="font-semibold text-gray-900 dark:text-white">Poker forum</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Strategy, hand reviews, online poker rooms, home games and clubs in Tbilisi.</p>
        </Link>
        <Link href="/tournaments?lang=en" className={card}>
          <div className="text-2xl mb-1">🏆</div>
          <h2 className="font-semibold text-gray-900 dark:text-white">Tournaments near Georgia</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">EPT, WPT, Triton and more within a few hours&apos; flight, with verified dates.</p>
        </Link>
        <Link href="/odds-calculator?lang=en" className={card}>
          <div className="text-2xl mb-1">🎲</div>
          <h2 className="font-semibold text-gray-900 dark:text-white">Poker odds calculator</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Hold&apos;em and Omaha equity for up to 6 hands, preflop to river.</p>
        </Link>
      </section>

      {upcoming.length > 0 && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Upcoming live poker near Georgia</h2>
          <ul className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
            {upcoming.map(t => (
              <li key={t.id} className="flex items-center gap-3 px-4 py-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={flagUrl(t)} width={20} height={14} alt={t.country.toUpperCase()} className="rounded-[2px]" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">{t.name}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{formatDates(t, 'en')} · {t.location}</div>
                </div>
                <span className="text-sm font-semibold text-brand-600">{t.buyin}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mb-10">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Poker in Georgia</h2>
        <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
          Georgia has an active live poker scene, with casino poker rooms in Tbilisi and the Black Sea resort of Batumi,
          and many Georgian players travel to series in Cyprus, Europe and beyond. pokerforum.ge brings this community
          together in one place — in Georgian and in English.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Frequently asked questions</h2>
        <dl className="space-y-3">
          {FAQ.map(f => (
            <div key={f.q} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
              <dt className="font-medium text-gray-900 dark:text-white">{f.q}</dt>
              <dd className="text-sm text-gray-600 dark:text-gray-400 mt-1">{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  )
}
