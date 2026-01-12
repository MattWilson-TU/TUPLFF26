import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { SessionProvider } from '@/components/session-provider'
import { ErrorHandler } from '@/components/error-handler'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Fantasy Football Auction',
  description: 'Build your dream squad through competitive auctions and manage your team through the Premier League season',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ErrorHandler />
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  )
}