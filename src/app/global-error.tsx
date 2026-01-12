'use client'

import { useEffect } from 'react'

// Helper function to check if an error is React error #310
function isError310(error: Error): boolean {
  const errorMessage = error.message || ''
  const errorStack = error.stack || ''
  const errorString = `${errorMessage} ${errorStack}`.toLowerCase()

  return (
    errorString.includes('error #310') ||
    errorString.includes('#310') ||
    errorString.includes('minified react error #310') ||
    errorString.includes('react.dev/errors/310')
  )
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    if (isError310(error)) {
      // Redirect to root URL to recover from the error
      window.location.href = '/'
      return
    }

    // For other errors, log them but don't redirect
    console.error('Global error caught:', error)
  }, [error])

  // If it's error #310, show redirecting message
  if (isError310(error)) {
    return (
      <html lang="en">
        <body>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            minHeight: '100vh',
            fontFamily: 'system-ui, sans-serif'
          }}>
            <p>Redirecting...</p>
          </div>
        </body>
      </html>
    )
  }

  // For other errors, show a fallback UI
  return (
    <html lang="en">
      <body>
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column',
          alignItems: 'center', 
          justifyContent: 'center', 
          minHeight: '100vh',
          fontFamily: 'system-ui, sans-serif',
          padding: '2rem'
        }}>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Something went wrong</h1>
          <p style={{ marginBottom: '1rem', color: '#666' }}>{error.message}</p>
          <button
            onClick={reset}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#0070f3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
