'use client'

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="ka">
      <body>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: '100vh', padding: '1rem', textAlign: 'center', fontFamily: 'sans-serif',
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>♠</div>
          <h1 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.25rem' }}>
            სერვისი დროებით მიუწვდომელია
          </h1>
          <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1.5rem' }}>
            Service temporarily unavailable. Please try again shortly.
          </p>
          <button
            onClick={reset}
            style={{
              padding: '0.5rem 1rem', backgroundColor: '#0a9560', color: 'white',
              fontSize: '0.875rem', fontWeight: 500, borderRadius: '0.5rem', border: 'none', cursor: 'pointer',
            }}
          >
            ხელახლა ცდა / Retry
          </button>
        </div>
      </body>
    </html>
  )
}
