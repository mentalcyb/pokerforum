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
      <body className="flex flex-col min-h-screen">
        <AppProvider>
          <Navbar />
          <main className="flex-1">{children}</main>
          <footer className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 mt-8">
            <div className="max-w-6xl mx-auto px-4 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-gray-500 dark:text-gray-400">
              <span>ყველა უფლებები დაცულია @2026 <span className="font-semibold text-gray-700 dark:text-gray-300">pokerforum.ge</span></span>
              <span>Contact: <a
                href="mailto:pokerforumge@gmail.com"
                className="hover:text-brand-600 transition-colors"
              >pokerforumge@gmail.com</a></span>
            </div>
          </footer>
        </AppProvider>
      </body>
    </html>
  )
}
