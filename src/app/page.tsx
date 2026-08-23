'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import styles from './landing.module.css'

const TITLE_LINES = [
  { text: 'Thunder Unicorn', className: styles.goldOutline },
  { text: 'Premier League', className: styles.goldLine },
  { text: 'Fantasy Football', className: styles.goldOutline },
] as const

const ENTER_MS = 1400
const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)'

function enterStyle(delayMs: number, active: boolean, divider = false): CSSProperties {
  return {
    opacity: active ? 1 : 0,
    transform: active
      ? divider
        ? 'translateY(0) scaleX(1)'
        : 'translateY(0) scale(1)'
      : divider
        ? 'translateY(4rem) scaleX(0)'
        : 'translateY(4rem) scale(0.88)',
    filter: active ? 'blur(0px)' : 'blur(16px)',
    transitionProperty: 'opacity, transform, filter, box-shadow',
    transitionDuration: `${ENTER_MS}ms`,
    transitionTimingFunction: EASE,
    transitionDelay: active ? `${delayMs}ms` : '0ms',
    willChange: 'opacity, transform, filter',
  }
}

export default function Home() {
  const { status } = useSession()
  const router = useRouter()
  const [active, setActive] = useState(false)

  useEffect(() => {
    if (status === 'authenticated') {
      router.push('/dashboard')
    }
  }, [status, router])

  useEffect(() => {
    if (status !== 'unauthenticated') {
      setActive(false)
      return
    }

    setActive(false)
    const timer = window.setTimeout(() => setActive(true), 80)

    return () => window.clearTimeout(timer)
  }, [status])

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-[#d4af37]/30 border-t-[#d4af37] mx-auto" />
          <p className="mt-4 text-[#d4af37]/60 text-sm tracking-wide">Loading...</p>
        </div>
      </div>
    )
  }

  if (status === 'authenticated') {
    return null
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] relative overflow-hidden flex items-center justify-center">
      <div
        className={cn(
          'absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(212,175,55,0.28)_0%,_transparent_65%)] transition-opacity duration-[2000ms]',
          styles.ambientGlow,
          active ? 'opacity-100' : 'opacity-0'
        )}
      />

      <main className="relative z-10 flex flex-col items-center text-center px-6 max-w-4xl">
        <span
          className="inline-block mb-8 px-4 py-1.5 text-sm font-medium tracking-widest uppercase text-[#d4af37] border border-[#d4af37]/40 rounded-full"
          style={enterStyle(0, active)}
        >
          2026–27 Season
        </span>

        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.15] mb-10">
          {TITLE_LINES.map((line, index) => (
            <span
              key={line.text}
              className={cn('block', line.className, index === 1 && active && styles.goldActive)}
              style={enterStyle(250 + index * 300, active)}
            >
              {line.text}
            </span>
          ))}
        </h1>

        <div
          className="w-32 h-px mb-10 origin-center bg-gradient-to-r from-transparent via-[#d4af37] to-transparent"
          style={enterStyle(1100, active, true)}
        />

        <Button
          asChild
          size="lg"
          className={cn(
            'bg-[#d4af37] text-[#0a0a0a] hover:bg-[#c9a227] font-semibold px-10 tracking-wide shadow-lg shadow-[#d4af37]/30 focus-visible:ring-[#d4af37]/50',
            active && styles.buttonPulse
          )}
          style={enterStyle(1350, active)}
        >
          <Link href="/auth/signin">Log In</Link>
        </Button>
      </main>
    </div>
  )
}
