/** Online poker rooms members can vote for on /rooms. Descriptions are our own, short and factual. */
export type Room = { id: string; name: string; color: string; ka: string; en: string }

export const ROOMS: Room[] = [
  { id: 'ggpoker', name: 'GGPoker', color: '#c8102e',
    ka: 'მსოფლიოში ყველაზე დიდი ონლაინ პოკერის ქსელი. აქ ტარდება WSOP Online. ბევრი ტურნირი და სწრაფი ფორმატები.',
    en: "The world's largest online poker network and home of WSOP Online. Huge tournament schedule and fast formats." },
  { id: 'pokerstars', name: 'PokerStars', color: '#d6001c',
    ka: 'ერთ-ერთი ყველაზე ცნობილი და ძველი რუმი. ცნობილია Sunday Million-ითა და Spin & Go-თი.',
    en: 'One of the best-known and longest-running rooms, famous for the Sunday Million and Spin & Go.' },
  { id: 'coinpoker', name: 'CoinPoker', color: '#16a34a',
    ka: 'კრიპტო რუმი — თამაში USDT-ით. ბოლო წლებში სწრაფად იზრდება.',
    en: 'Crypto room — play with USDT. Growing fast in recent years.' },
  { id: 'acr', name: 'ACR (Americas Cardroom)', color: '#e11d48',
    ka: 'Winning Poker Network-ის მთავარი რუმი. ცნობილია Venom ტურნირებით, იღებს კრიპტოს.',
    en: 'Flagship of the Winning Poker Network, known for the Venom tournaments; accepts crypto.' },
  { id: 'wptglobal', name: 'WPT Global', color: '#1d4ed8',
    ka: 'World Poker Tour-ის ონლაინ რუმი, გახსნილია 2022 წელს.',
    en: "The World Poker Tour's online room, launched in 2022." },
  { id: 'pokerking', name: 'PokerKing', color: '#ca8a04',
    ka: 'Winning Poker Network-ის რუმი, ACR-ის მსგავსი ტურნირებით.',
    en: 'A Winning Poker Network room with a tournament schedule similar to ACR.' },
  { id: 'redstar', name: 'RedStar Poker', color: '#b91c1c',
    ka: 'ევროპაში პოპულარული რუმი, კეშ თამაშებითა და ტურნირებით.',
    en: 'A room popular in Europe, with cash games and tournaments.' },
  { id: '888poker', name: '888poker', color: '#0284c7',
    ka: 'ერთ-ერთი ძველი და ცნობილი ბრენდი, ბევრი იაფი ტურნირით.',
    en: 'A long-running, well-known brand with lots of low buy-in tournaments.' },
  { id: 'partypoker', name: 'partypoker', color: '#7c3aed',
    ka: 'კლასიკური ბრენდი ონლაინ პოკერის ადრეული წლებიდან.',
    en: 'A classic brand from the early years of online poker.' },
  { id: 'winamax', name: 'Winamax', color: '#dc2626',
    ka: 'ფრანგული რუმი, პოპულარულია საფრანგეთსა და ესპანეთში. ცნობილია Expresso ფორმატით.',
    en: 'French room, popular in France and Spain, known for the Expresso format.' },
  { id: 'pppoker', name: 'PPPoker', color: '#0d9488',
    ka: 'მობილური აპლიკაცია პოკერის კლუბებით.',
    en: 'Mobile app built around private poker clubs.' },
  { id: 'clubgg', name: 'ClubGG', color: '#9333ea',
    ka: 'GG-ის კლუბების აპლიკაცია — მეგობრებთან და კლუბებში თამაშისთვის.',
    en: "GG's club app for playing with friends and in clubs." },
]

export const ROOM_IDS = new Set(ROOMS.map(r => r.id))
export const MAX_ROOMS_PER_USER = 3
