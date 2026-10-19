/**
 * Georgia all-time live tournament earnings, TOP 25.
 * Source: The Hendon Mob (https://pokerdb.thehendonmob.com/ranking/274/).
 * Updated by hand — paste the new table and change RANKINGS_UPDATED.
 */
export const RANKINGS_SOURCE_URL = 'https://pokerdb.thehendonmob.com/ranking/274/'
export const RANKINGS_UPDATED = '2026-10-19'

export type RankedPlayer = { rank: number; name: string; earnings: number }

export const GEORGIA_TOP: RankedPlayer[] = [
  { rank: 1, name: 'Giorgiy Skhulukhiya', earnings: 5894139 },
  { rank: 2, name: 'Ilia Kitsbabashvili', earnings: 506322 },
  { rank: 3, name: 'Vazha Kometiani', earnings: 465420 },
  { rank: 4, name: 'Davit Mikhanashvili', earnings: 438601 },
  { rank: 5, name: 'Giorgi Barabadze', earnings: 378001 },
  { rank: 6, name: 'Tamazi Skhirtladze', earnings: 355365 },
  { rank: 7, name: 'Tornike Tchkonia', earnings: 319924 },
  { rank: 8, name: 'Levan Rcheulishvili', earnings: 251966 },
  { rank: 9, name: 'Artem Arakelian', earnings: 223319 },
  { rank: 10, name: 'Aleksandre Apryan', earnings: 203108 },
  { rank: 11, name: 'Vladimer Gigolashvili', earnings: 194279 },
  { rank: 12, name: 'Nino Papava', earnings: 192248 },
  { rank: 13, name: 'Revaz Gudzhabidze', earnings: 188752 },
  { rank: 14, name: 'Nugzar Glonti', earnings: 182504 },
  { rank: 15, name: 'Giorgy Kitasashvily', earnings: 168272 },
  { rank: 16, name: 'Zurab Ejibia', earnings: 166286 },
  { rank: 17, name: 'I Khazaradze', earnings: 155835 },
  { rank: 18, name: 'Giorgi Darchia', earnings: 146600 },
  { rank: 19, name: 'Avtandil Magradze', earnings: 142367 },
  { rank: 20, name: 'Beka Magradze', earnings: 137856 },
  { rank: 21, name: 'Giorgi Gorgaslidze', earnings: 134415 },
  { rank: 22, name: 'Lazare Kalebashvili', earnings: 128534 },
  { rank: 23, name: 'Ruben Hovsepyan', earnings: 119393 },
  { rank: 24, name: 'Giorgi Mevlupishvili', earnings: 118400 },
  { rank: 25, name: 'Andria Gogelidze', earnings: 115765 },
]

export function formatUsd(n: number): string {
  return '$' + n.toLocaleString('en-US')
}
