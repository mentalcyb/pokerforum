'use client'
import { useEffect } from 'react'
import { useApp } from '@/contexts/AppContext'
import type { Lang } from '@/lib/translations'

/** Switches the site language when a page is only available in one language (e.g. /en pages). */
export default function SetLanguage({ lang }: { lang: Lang }) {
  const { lang: current, setLang } = useApp()
  useEffect(() => {
    if (current !== lang) setLang(lang)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return null
}
