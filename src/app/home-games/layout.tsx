import type { Metadata } from 'next'

// Search-friendly title/description for "პოკერი მეგობრებთან" (the page itself is a client component).
export const metadata: Metadata = {
  title: 'პოკერი მეგობრებთან — ითამაშე ონლაინ უფასოდ | pokerforum.ge',
  description:
    'შექმენი პრივატული პოკერის მაგიდა, გაუგზავნე ლინკი მეგობრებს და ითამაშეთ Texas Hold\'em ბრაუზერში — უფასოდ, სათამაშო ჩიპებით. ქეშ თამაში და ტურნირი (Sit & Go), ჩატი, ხელების ისტორია.',
  keywords: [
    'პოკერი მეგობრებთან', 'ონლაინ პოკერი მეგობრებთან', 'პოკერი ონლაინ უფასოდ', 'პოკერის თამაში',
    'ჰოლდემი', 'texas holdem', 'poker with friends', 'home game', 'პოკერის ფორუმი', 'pokerforum.ge',
  ],
  alternates: { canonical: '/home-games' },
  openGraph: {
    title: 'პოკერი მეგობრებთან — pokerforum.ge',
    description: 'პრივატული პოკერის მაგიდა მეგობრებისთვის. უფასოდ, სათამაშო ჩიპებით, პირდაპირ ბრაუზერში.',
    url: 'https://pokerforum.ge/home-games',
    locale: 'ka_GE',
    type: 'website',
  },
}

// Structured data so search engines understand this is a free browser game with FAQs.
const jsonLd = [
  {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'პოკერი მეგობრებთან — pokerforum.ge',
    url: 'https://pokerforum.ge/home-games',
    applicationCategory: 'GameApplication',
    operatingSystem: 'Any (web browser)',
    inLanguage: ['ka', 'en'],
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'GEL' },
    description: 'პრივატული Texas Hold\'em მაგიდები მეგობრებისთვის, სათამაშო ჩიპებით.',
  },
  {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'როგორ ვითამაშო პოკერი მეგობრებთან ონლაინ?',
        acceptedAnswer: { '@type': 'Answer', text: 'pokerforum.ge-ზე შექმენი მაგიდა, დააკოპირე მოსაწვევი ლინკი და გაუგზავნე მეგობრებს. როცა ორი ან მეტი მოთამაშე დაჯდება, დააჭირე „თამაშის დაწყებას“.' },
      },
      {
        '@type': 'Question',
        name: 'უფასოა პოკერი მეგობრებთან?',
        acceptedAnswer: { '@type': 'Answer', text: 'კი, სრულიად უფასოა. თამაში მიმდინარეობს მხოლოდ სათამაშო ჩიპებით, რეალური ფული არ გამოიყენება.' },
      },
      {
        '@type': 'Question',
        name: 'შეიძლება ტურნირის მოწყობა მეგობრებისთვის?',
        acceptedAnswer: { '@type': 'Answer', text: 'კი. აირჩიე „ტურნირი (Sit & Go)“ — ბლაინდები ავტომატურად იზრდება ყოველ რამდენიმე წუთში და ბოლოს ერთი გამარჯვებული რჩება.' },
      },
    ],
  },
]

export default function HomeGamesLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {children}
    </>
  )
}
