import type { Metadata } from 'next'
import './globals.css'
import { AppProvider } from '@/contexts/AppContext'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'

export const metadata: Metadata = {
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
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ka" suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <AppProvider>
          <Navbar />
          <main className="flex-1">{children}</main>
          <Footer />
        </AppProvider>
      </body>
    </html>
  )
}
