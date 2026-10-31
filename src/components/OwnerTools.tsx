'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import TestAccounts from '@/components/TestAccounts'
import PasswordReset from '@/components/PasswordReset'

/** Tools only the site owner sees (OWNER_EMAIL). Other admins get nothing, and the API refuses them too. */
export default function OwnerTools() {
  const [owner, setOwner] = useState(false)
  useEffect(() => {
    createClient().auth.getSession().then(async ({ data }) => {
      const tk = data.session?.access_token
      if (!tk) return
      const res = await fetch('/api/admin/whoami', { headers: { Authorization: `Bearer ${tk}` } })
      if (res.ok) setOwner(!!(await res.json()).owner)
    })
  }, [])
  if (!owner) return null
  return (<><TestAccounts /><PasswordReset /></>)
}
