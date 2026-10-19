/** Shown right after clicking a story, while the page (and, the first time, the article) is prepared. */
export default function Loading() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 animate-pulse">
      <div className="h-4 w-28 rounded bg-gray-200 dark:bg-gray-800" />
      <div className="mt-5 h-8 w-11/12 rounded bg-gray-200 dark:bg-gray-800" />
      <div className="mt-2 h-8 w-2/3 rounded bg-gray-200 dark:bg-gray-800" />
      <p className="mt-6 text-sm text-gray-500">📰 სტატია იტვირთება… / Loading article…</p>
      <div className="mt-4 space-y-3">
        {[...Array(6)].map((_, i) => <div key={i} className="h-4 rounded bg-gray-200 dark:bg-gray-800" style={{ width: `${90 - (i % 3) * 12}%` }} />)}
      </div>
    </div>
  )
}
