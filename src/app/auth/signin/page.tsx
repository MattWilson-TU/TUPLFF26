'use client'

import { useState, useEffect, type CSSProperties } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import styles from '@/app/landing.module.css'

const ENTER_MS = 900
const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)'

function enterStyle(delayMs: number, active: boolean): CSSProperties {
  return {
    opacity: active ? 1 : 0,
    transform: active ? 'translateY(0)' : 'translateY(1.5rem)',
    filter: active ? 'blur(0px)' : 'blur(8px)',
    transitionProperty: 'opacity, transform, filter',
    transitionDuration: `${ENTER_MS}ms`,
    transitionTimingFunction: EASE,
    transitionDelay: active ? `${delayMs}ms` : '0ms',
  }
}

export default function SignInPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [active, setActive] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const timer = window.setTimeout(() => setActive(true), 80)
    return () => window.clearTimeout(timer)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const result = await signIn('credentials', {
        username,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError('Invalid credentials')
      } else {
        router.push('/dashboard')
      }
    } catch {
      setError('An error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] relative overflow-hidden flex items-center justify-center px-4">
      <div
        className={cn(
          'absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(212,175,55,0.28)_0%,_transparent_65%)] opacity-100',
          styles.ambientGlow
        )}
      />

      <div
        className="relative z-10 w-full max-w-md rounded-xl border border-[#d4af37]/25 bg-[#0a0a0a]/90 p-8 shadow-2xl shadow-[#d4af37]/10 backdrop-blur-sm"
        style={enterStyle(0, active)}
      >
        <div className="text-center mb-8" style={enterStyle(100, active)}>
          <span className="inline-block mb-4 px-3 py-1 text-xs font-medium tracking-widest uppercase text-[#d4af37] border border-[#d4af37]/40 rounded-full">
            2026–27 Season
          </span>
          <h1 className="text-2xl font-bold text-[#d4af37] tracking-wide">Log In</h1>
          <div className="w-16 h-px mx-auto mt-4 bg-gradient-to-r from-transparent via-[#d4af37]/60 to-transparent" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex flex-col items-center gap-2" style={enterStyle(200, active)}>
            <Label htmlFor="username" className="text-[#d4af37] tracking-wide">
              Username
            </Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-[70%] max-w-[200px] h-11 rounded-full border-2 border-[#d4af37]/60 bg-[#111111] px-5 text-white shadow-md shadow-[#d4af37]/10 placeholder:text-[#d4af37]/40 focus-visible:border-[#d4af37] focus-visible:ring-[#d4af37]/35"
            />
          </div>

          <div className="flex flex-col items-center gap-2" style={enterStyle(300, active)}>
            <Label htmlFor="password" className="text-[#d4af37] tracking-wide">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-[70%] max-w-[200px] h-11 rounded-full border-2 border-[#d4af37]/60 bg-[#111111] px-5 text-white shadow-md shadow-[#d4af37]/10 placeholder:text-[#d4af37]/40 focus-visible:border-[#d4af37] focus-visible:ring-[#d4af37]/35"
            />
          </div>

          {error && (
            <p className="text-sm text-red-400 text-center" style={enterStyle(350, active)}>
              {error}
            </p>
          )}

          <div className="flex justify-center" style={enterStyle(400, active)}>
            <Button
              type="submit"
              className={cn(
                'w-[70%] max-w-[200px] h-11 rounded-full bg-[#d4af37] text-[#0a0a0a] hover:bg-[#c9a227] font-semibold tracking-wide shadow-lg shadow-[#d4af37]/20 focus-visible:ring-[#d4af37]/50',
                active && styles.buttonPulse
              )}
              disabled={isLoading}
            >
              {isLoading ? 'Signing in...' : 'Log In'}
            </Button>
          </div>
        </form>

        <div className="mt-6 text-center" style={enterStyle(500, active)}>
          <p className="text-sm text-[#d4af37]/50">
            Don&apos;t have an account?{' '}
            <Link
              href="/auth/signup"
              className="text-[#d4af37] hover:text-[#fff0a8] transition-colors"
            >
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
