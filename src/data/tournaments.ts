// Upcoming live series within a few hours' flight of Georgia.
//
// Every entry is checked against an announcement (see `source`). Dates are real
// ISO dates: tournaments disappear from the site automatically once they end,
// so the list never shows past events. To add one, copy an entry and fill in
// the fields; leave `guarantee` out unless it was officially announced.

export type Tournament = {
  id: number
  name: string
  series: string
  location: string
  location_ka: string
  /** ISO 3166 country code, used for the flag image */
  country: string
  /** first and last day, YYYY-MM-DD */
  start: string
  end: string
  /** main event buy-in */
  buyin: string
  guarantee?: string
  website: string
  /** where the dates/buy-in were confirmed */
  source: string
  notes: string
  notes_ka: string
}

const tournaments: Tournament[] = [
  {
    id: 101,
    name: 'WPT Prime Cyprus',
    series: 'WPT',
    location: 'Chamada Prestige Hotel, North Cyprus',
    location_ka: 'Chamada Prestige Hotel, ჩრდილოეთ კვიპროსი',
    country: 'cy',
    start: '2026-10-15',
    end: '2026-10-19',
    buyin: '$1,100',
    website: 'https://www.wpt.com/',
    source: 'https://pokerfuse.com/latest-news/2026/8/major-wpt-events-coming-online-satellites/',
    notes: 'WPT Prime Championship',
    notes_ka: 'WPT Prime ჩემპიონატი',
  },
  {
    id: 102,
    name: 'PokerStars Open Aix-en-Provence',
    series: 'PokerStars',
    location: 'Aix-en-Provence, France',
    location_ka: 'ექს-ან-პროვანსი, საფრანგეთი',
    country: 'fr',
    start: '2026-11-02',
    end: '2026-11-08',
    buyin: '€1,100',
    guarantee: '€1,000,000',
    website: 'https://www.pokerstars.com/poker/live/',
    source: 'https://www.pokertube.com/?p=145317',
    notes: 'New PokerStars Open stop',
    notes_ka: 'PokerStars Open-ის ახალი ეტაპი',
  },
  {
    id: 103,
    name: 'Triton ONE Northern Cyprus',
    series: 'Triton',
    location: 'Merit Royal Diamond, Kyrenia, North Cyprus',
    location_ka: 'Merit Royal Diamond, კირენია, ჩრდილოეთ კვიპროსი',
    country: 'cy',
    start: '2026-11-05',
    end: '2026-11-15',
    buyin: '$8,000',
    website: 'https://triton-series.com/',
    source: 'https://www.pokertube.com/?p=145689',
    notes: 'Mid-stakes Triton festival, $3,000 events from day one',
    notes_ka: 'Triton-ის საშუალო ფსონების ფესტივალი, $3,000-იანი ტურნირებით',
  },
  {
    id: 104,
    name: 'Triton Super High Roller Series',
    series: 'Triton',
    location: 'Merit Royal Diamond, Kyrenia, North Cyprus',
    location_ka: 'Merit Royal Diamond, კირენია, ჩრდილოეთ კვიპროსი',
    country: 'cy',
    start: '2026-11-15',
    end: '2026-11-30',
    buyin: 'High roller',
    website: 'https://triton-series.com/',
    source: 'https://www.pokertube.com/?p=145689',
    notes: 'The biggest buy-ins in poker — great to follow live',
    notes_ka: 'პოკერის ყველაზე დიდი ბაი-ინები — საინტერესოა ლაივში საყურებლად',
  },
  {
    id: 105,
    name: 'EPT Prague',
    series: 'EPT',
    location: 'Prague, Czech Republic',
    location_ka: 'პრაღა, ჩეხეთი',
    country: 'cz',
    start: '2026-12-02',
    end: '2026-12-13',
    buyin: '€5,300',
    website: 'https://www.pokerstars.com/poker/live/european-poker-tour/',
    source: 'https://www.pokerlistings.com/news/ept-prague-returns-to-the-2026-pokerstars-calendar',
    notes: 'Main Event from Dec 7; also PokerStars Open Main Event €1,100',
    notes_ka: 'მთავარი ტურნირი 7 დეკემბრიდან; ასევე PokerStars Open Main Event €1,100',
  },
].sort((a, b) => a.start.localeCompare(b.start))

export default tournaments

/** Today's date in Tbilisi as YYYY-MM-DD. */
function todayInTbilisi(now: Date): string {
  const tbilisi = new Date(now.getTime() + now.getTimezoneOffset() * 60000 + 4 * 3600000)
  const m = String(tbilisi.getMonth() + 1).padStart(2, '0')
  const d = String(tbilisi.getDate()).padStart(2, '0')
  return `${tbilisi.getFullYear()}-${m}-${d}`
}

/** Tournaments that haven't finished yet, soonest first. */
export function upcomingTournaments(now: Date = new Date()): Tournament[] {
  const today = todayInTbilisi(now)
  return tournaments.filter(t => t.end >= today)
}

const MONTHS: Record<'ka' | 'en', string[]> = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  ka: ['იან', 'თებ', 'მარ', 'აპრ', 'მაი', 'ივნ', 'ივლ', 'აგვ', 'სექ', 'ოქტ', 'ნოე', 'დეკ'],
}

/** "15–19 Oct 2026", "28 Oct – 3 Nov 2026", "28 დეკ 2026 – 3 იან 2027" */
export function formatDates(t: Tournament, lang: 'ka' | 'en'): string {
  const [sy, sm, sd] = t.start.split('-').map(Number)
  const [ey, em, ed] = t.end.split('-').map(Number)
  const mon = MONTHS[lang]
  if (sy !== ey) return `${sd} ${mon[sm - 1]} ${sy} – ${ed} ${mon[em - 1]} ${ey}`
  if (sm !== em) return `${sd} ${mon[sm - 1]} – ${ed} ${mon[em - 1]} ${ey}`
  return sd === ed ? `${sd} ${mon[sm - 1]} ${sy}` : `${sd}–${ed} ${mon[sm - 1]} ${sy}`
}

/** Localized free-text field. */
export function trField(t: Tournament, field: 'location' | 'dates' | 'notes', lang: 'ka' | 'en'): string {
  if (field === 'dates') return formatDates(t, lang)
  if (lang === 'ka') return field === 'location' ? t.location_ka : t.notes_ka
  return t[field]
}

export function flagUrl(t: Tournament): string {
  return `https://flagcdn.com/w20/${t.country}.png`
}
