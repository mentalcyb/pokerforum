'use client'
import { useEffect, useState } from 'react'
import { upcomingTournaments, type Tournament } from '@/data/tournaments'

/**
 * Tournaments that haven't ended yet, re-checked in the browser so a page built
 * days ago never shows events that are already over.
 */
export function useUpcomingTournaments(): Tournament[] {
  const [list, setList] = useState<Tournament[]>(() => upcomingTournaments())
  useEffect(() => { setList(upcomingTournaments()) }, [])
  return list
}
