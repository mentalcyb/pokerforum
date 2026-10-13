import type { Metadata } from 'next'
import './globals.css'
import { AppProvider } from '@/contexts/AppContext'
import { PresenceProvider } from '@/contexts/PresenceContext'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'

export const metadata: Metadata = {
  // makes relative canonical/OG URLs absolute
  metadataBase: new URL('https://pokerforum.ge'),
  title: 'პოკერის ფორუმი - ქართული პოკერის საზოგადოება | pokerforum.ge',
  description: 'ქართული პოკერის ფორუმი - განიხილე სტრატეგია, ტურნირები და სიახლეები. საქართველოს უმსხვილესი პოკერის საზოგადოება.',
  keywords: 'პოკერის ფორუმი, ქართული პოკერი, poker forum georgia, პოკერი საქართველო',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
  },
  verification: {
    google: 'f8HPZ7bi689zW3MS7Oqc3Y3LLp0bFlsCHBFCLrh39EI',
  },
  openGraph: {
    title: 'პოკერის ფორუმი | pokerforum.ge',
    description: 'ქართული პოკერის მთავარი ფორუმი',
    url: 'https://pokerforum.ge',
    locale: 'ka_GE',
    type: 'website',
  },
  // The site has its own dark mode: ask Dark Reader-style extensions not to recolor it
  // (they turned the poker table black and the cards dark).
  other: {
    'darkreader-lock': '',
  },
}

// Tells browsers (e.g. Chrome's "auto dark mode for web contents") that the site
// supports both light and dark itself, so they don't force-invert its colors.
export const viewport = {
  colorScheme: 'light dark',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ka" suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <AppProvider>
        <PresenceProvider>
          <Navbar />
          <main className="flex-1">{children}</main>
          <Footer />
        </PresenceProvider>
        </AppProvider>
      </body>
    </html>
  )
}
