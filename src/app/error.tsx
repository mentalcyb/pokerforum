'use client'

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 text-center">
      <div className="text-4xl mb-4">♠</div>
      <h1 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
        სერვისი დროებით მიუწვდომელია
      </h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Service temporarily unavailable. Please try again shortly.
      </p>
      <button
        onClick={reset}
        className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors"
      >
        ხელახლა ცდა / Retry
      </button>
    </div>
  )
}
