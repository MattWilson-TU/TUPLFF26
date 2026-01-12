'use client'

import { useEffect } from 'react'

/**
 * Client-side error handler that catches window-level errors
 * and React errors that might not be caught by error boundaries.
 * Specifically handles React error #310 by redirecting to root.
 */
export function ErrorHandler() {
  useEffect(() => {
    // Function to check if an error is React error #310
    const isError310 = (error: Error | string): boolean => {
      const errorString = typeof error === 'string' 
        ? error.toLowerCase()
        : `${error.message || ''} ${error.stack || ''}`.toLowerCase()
      
      return (
        errorString.includes('error #310') ||
        errorString.includes('#310') ||
        errorString.includes('minified react error #310') ||
        errorString.includes('react.dev/errors/310')
      )
    }

    // Handle window errors
    const handleError = (event: ErrorEvent) => {
      const errorMessage = event.message || ''
      const errorSource = event.filename || ''
      const errorString = `${errorMessage} ${errorSource}`.toLowerCase()

      if (
        isError310(errorMessage) ||
        isError310(errorString) ||
        errorString.includes('error #310') ||
        errorString.includes('#310')
      ) {
        console.warn('React error #310 detected, redirecting to root...')
        window.location.href = '/'
      }
    }

    // Handle unhandled promise rejections
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const error = event.reason
      if (error && (error instanceof Error || typeof error === 'string')) {
        if (isError310(error)) {
          console.warn('React error #310 detected in promise rejection, redirecting to root...')
          window.location.href = '/'
        }
      }
    }

    // Listen for React error events (if React DevTools or error reporting is available)
    const handleReactError = (event: CustomEvent) => {
      const error = event.detail?.error || event.detail
      if (error && (error instanceof Error || typeof error === 'string')) {
        if (isError310(error)) {
          console.warn('React error #310 detected via custom event, redirecting to root...')
          window.location.href = '/'
        }
      }
    }

    // Attach event listeners
    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleUnhandledRejection)
    window.addEventListener('react-error', handleReactError as EventListener)

    // Cleanup
    return () => {
      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
      window.removeEventListener('react-error', handleReactError as EventListener)
    }
  }, [])

  // This component doesn't render anything
  return null
}
