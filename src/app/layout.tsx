import type { Metadata } from 'next'
import './globals.css'
import { AppProvider } from '@/contexts/AppContext'
import Navbar from '@/components/Navbar'

export const metadata: Metadata = {
  title: 'pokerforum.ge',
  description: 'პირველი ქართული პოკერის ფორუმი',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ka" suppressHydrationWarning>
      <body>
        <AppProvider>
          <Navbar />
          <main className="min-h-screen">{children}</main>
        </AppProvider>
      </body>
    </html>
  )
}
