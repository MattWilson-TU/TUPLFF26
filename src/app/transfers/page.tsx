'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

const PHASES = [
  {
    phase: 1,
    gameweeks: '1-11',
    description: 'Opening phase of the season'
  },
  {
    phase: 2,
    gameweeks: '12-26',
    description: 'Mid-season phase'
  },
  {
    phase: 3,
    gameweeks: '27-31',
    description: 'Late season phase'
  },
  {
    phase: 4,
    gameweeks: '32-38',
    description: 'Final phase of the season'
  }
]

export default function TransfersPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [currentPhase, setCurrentPhase] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
    }
  }, [status, router])

  useEffect(() => {
    async function loadCurrentPhase() {
      try {
        const res = await fetch('/api/gameweek/current-phase')
        if (res.ok) {
          const data = await res.json()
          setCurrentPhase(data.phase || null)
        }
      } catch (error) {
        console.error('Error loading current phase:', error)
      } finally {
        setLoading(false)
      }
    }
    if (status === 'authenticated') {
      loadCurrentPhase()
    }
  }, [status])

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading transfers...</p>
        </div>
      </div>
    )
  }

  if (!session) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Transfers</h1>
              <p className="text-gray-600">
                Transfer windows between game phases
                {currentPhase && ` (Currently in Phase ${currentPhase})`}
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href="/dashboard">← Back to Dashboard</Link>
            </Button>
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>About Transfer Windows</CardTitle>
            <CardDescription>
              Make transfers between phases to optimize your squad
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              The season is divided into 4 phases. Transfer windows open between phases, allowing you to swap players in and out of your squad. 
              This feature is currently under development.
            </p>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {PHASES.map((phaseInfo) => (
            <Card 
              key={phaseInfo.phase} 
              className={currentPhase === phaseInfo.phase ? 'ring-2 ring-blue-500' : ''}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Phase {phaseInfo.phase}</CardTitle>
                  {currentPhase === phaseInfo.phase && (
                    <Badge className="bg-blue-600">Current</Badge>
                  )}
                </div>
                <CardDescription>
                  Gameweeks {phaseInfo.gameweeks}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  {phaseInfo.description}
                </p>
                <div className="pt-4 border-t">
                  <p className="text-xs text-gray-500">
                    Transfer window opens after Phase {phaseInfo.phase} completes
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Coming Soon</CardTitle>
            <CardDescription>
              Transfer functionality is being developed
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              The transfer system will allow you to:
            </p>
            <ul className="list-disc list-inside mt-2 text-sm text-gray-600 space-y-1">
              <li>Swap players between phases during transfer windows</li>
              <li>Manage your squad composition across different phases</li>
              <li>Track transfer history and price differences</li>
              <li>Optimize your team for upcoming gameweeks</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
