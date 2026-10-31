'use client'
import AdminConcierge from '@/components/AdminConcierge'

/** Team page with only the visitors' chats (easy to open on a phone). The API checks admin rights. */
export default function ChatsPage() {
  return (
    <div className="max-w-6xl mx-auto px-3 py-6">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-4">💬 სტუმრების ჩატი</h1>
      <AdminConcierge />
    </div>
  )
}
