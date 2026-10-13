import type { Metadata } from 'next'
import Link from 'next/link'
import SetLanguage from '@/components/SetLanguage'

export const metadata: Metadata = {
  title: 'Play Poker with Friends Online — Free Private Tables, No Download | pokerforum.ge',
  description:
    'Create a free private Texas Hold\'em table, send the link to your friends and play in the browser. Cash games or Sit & Go tournaments, up to 9 players, chat and hand replays. Play chips only — no real money, no sign-up fees, no download.',
  keywords: [
    'play poker with friends', 'poker with friends online free', 'private poker table', 'online home game',
    'texas holdem with friends', 'free poker no download', 'sit and go with friends', 'poker night online',
  ],
  alternates: {
    canonical: '/en/play-poker-with-friends',
    languages: { ka: '/home-games', en: '/en/play-poker-with-friends', 'x-default': '/home-games' },
  },
  openGraph: {
    title: 'Play Poker with Friends Online — Free | pokerforum.ge',
    description: 'Private Hold\'em tables for your friends. Free, play chips only, right in the browser.',
    url: 'https://pokerforum.ge/en/play-poker-with-friends',
    locale: 'en_US',
    alternateLocale: ['ka_GE'],
    type: 'website',
  },
}

const FEATURES = [
  ['🔗', 'Invite with a link', 'Create a table and share the link — friends join in one click.'],
  ['🏆', 'Cash game or tournament', 'Fixed blinds with rebuys, or a Sit & Go where blinds rise every few minutes.'],
  ['👥', 'Up to 9 players', 'Heads-up to full ring. Spectators can watch too.'],
  ['💬', 'Table chat', 'Banter with your friends while you play.'],
  ['🎬', 'Hand replays', 'Watch previous hands again, step by step.'],
  ['📱', 'Works on phones', 'Any modern browser — nothing to install.'],
] as const

const FAQ = [
  { q: 'Is it really free?', a: 'Yes. Tables are free and the game uses play chips only — there is no real money involved at any point.' },
  { q: 'Do my friends need to download anything?', a: 'No. Everything runs in the browser on computers and phones. Players need a free pokerforum.ge account to take a seat.' },
  { q: 'Which poker variants are supported?', a: 'No-Limit Texas Hold\'em, as a cash game (with rebuys and a settlement table) or as a Sit & Go tournament with a rising blind structure.' },
  { q: 'Can I control the game as the host?', a: 'Yes — pause and resume, change blinds and the turn timer between hands, remove a player, and start a new tournament when one ends.' },
]

export default function PlayWithFriends() {
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'Poker with Friends — pokerforum.ge',
      url: 'https://pokerforum.ge/en/play-poker-with-friends',
      applicationCategory: 'GameApplication',
      operatingSystem: 'Any (web browser)',
      inLanguage: ['en', 'ka'],
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      description: 'Free private Texas Hold\'em tables for friends, played with play chips in the browser.',
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: FAQ.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    },
  ]

  return (
    <div className="max-w-4xl mx-auto px-4 py-8" lang="en">
      <SetLanguage lang="en" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <header className="text-center mb-10">
        <div className="text-4xl mb-2">🃏</div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-3">Play Poker with Friends Online — Free</h1>
        <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed">
          Set up a private Texas Hold&apos;em table in seconds, send the invite link to your friends and play together in
          the browser. No download, no fees — just play chips and a good poker night.
        </p>
        <Link href="/home-games?lang=en"
          className="inline-block mt-5 px-6 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold transition-colors">
          Create a free table →
        </Link>
        <p className="text-xs text-amber-700 dark:text-amber-400 mt-2">🪙 Play chips only — no real money involved.</p>
      </header>

      <section className="mb-10">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">How it works</h2>
        <ol className="grid gap-3 sm:grid-cols-3">
          {[
            'Create a table — pick a cash game or a tournament, blinds and seats.',
            'Copy the invite link and send it to your friends (WhatsApp, Telegram, Messenger…).',
            'When two or more players are seated, press Start and shuffle up and deal.',
          ].map((step, i) => (
            <li key={i} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 text-sm text-gray-700 dark:text-gray-300">
              <span className="block text-brand-600 font-bold mb-1">Step {i + 1}</span>
              {step}
            </li>
          ))}
        </ol>
      </section>

      <section className="mb-10">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Everything you need for a home game</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(([icon, title, text]) => (
            <div key={title} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
              <div className="text-xl">{icon}</div>
              <h3 className="font-medium text-gray-900 dark:text-white mt-1">{title}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-10">
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

      <p className="text-center text-sm text-gray-500 dark:text-gray-400">
        Part of <Link href="/en" className="text-brand-600 font-medium">pokerforum.ge — the Georgian Poker Forum</Link>.
      </p>
    </div>
  )
}
