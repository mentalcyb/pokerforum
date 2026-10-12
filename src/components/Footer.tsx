'use client'
import { useApp } from '@/contexts/AppContext'

export default function Footer() {
  const { t } = useApp()
  return (
    <footer className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 mt-8">
      <div className="max-w-6xl mx-auto px-4 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-gray-500 dark:text-gray-400">
        <span>© 2026 <span className="font-semibold text-gray-700 dark:text-gray-300">pokerforum.ge</span> · {t.allRightsReserved}</span>
        <span>{t.contact}: <a
          href="mailto:pokerforumge@gmail.com"
          className="hover:text-brand-600 transition-colors"
        >pokerforumge@gmail.com</a></span>
      </div>
    </footer>
  )
}
