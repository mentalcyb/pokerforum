'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { translations, Lang, T } from '@/lib/translations'

type AppContextType = {
  lang: Lang
  setLang: (l: Lang) => void
  t: T
  dark: boolean
  toggleDark: () => void
}

const AppContext = createContext<AppContextType | null>(null)

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('ka')
  const [dark, setDark] = useState(false)

  useEffect(() => {
    const savedLang = localStorage.getItem('lang') as Lang
    const savedDark = localStorage.getItem('dark')
    if (savedLang) setLangState(savedLang)
    if (savedDark === 'true') {
      setDark(true)
      document.documentElement.classList.add('dark')
    }
  }, [])

  const setLang = (l: Lang) => {
    setLangState(l)
    localStorage.setItem('lang', l)
  }

  const toggleDark = () => {
    setDark(prev => {
      const next = !prev
      localStorage.setItem('dark', String(next))
      if (next) document.documentElement.classList.add('dark')
      else document.documentElement.classList.remove('dark')
      return next
    })
  }

  return (
    <AppContext.Provider value={{ lang, setLang, t: translations[lang], dark, toggleDark }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
