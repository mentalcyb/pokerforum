interface ErrorStateProps {
  message: string
  retryLabel: string
  onRetry: () => void
}

export default function ErrorState({ message, retryLabel, onRetry }: ErrorStateProps) {
  return (
    <div className="p-8 text-center text-red-500 text-sm">
      {message}
      <button onClick={onRetry} className="block mx-auto mt-2 text-brand-600 underline text-xs">
        {retryLabel}
      </button>
    </div>
  )
}
