'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

interface Manager {
  id: string
  name: string
  username: string
  budgetKGBP: number
  computedTotalPoints?: number
  recentGwPoints?: number
  recentGwId?: number
  wd?: number
  squads: {
    id: string
    phase: number
    totalPoints: number
    players: {
      player: {
        id: number
        firstName: string
        secondName: string
        totalPoints: number
      }
    }[]
  }[]
}

export default function LeaguePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [managers, setManagers] = useState<Manager[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [dataLastUpdated, setDataLastUpdated] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
    }
  }, [status, router])

  useEffect(() => {
    fetchManagers()
  }, [])

  useEffect(() => {
    async function loadDataLastUpdated() {
      try {
        const res = await fetch('/api/data/last-updated')
        if (!res.ok) return
        const data = await res.json()
        if (data?.lastUpdated) {
          setDataLastUpdated(data.lastUpdated)
        } else {
          setDataLastUpdated(null)
        }
      } catch (error) {
        console.error('Failed to load data last updated timestamp', error)
      }
    }
    loadDataLastUpdated()
  }, [])

  const fetchManagers = async () => {
    try {
      const response = await fetch('/api/managers')
      if (response.ok) {
        const data = await response.json()
        // Exclude admin in UI as well, in case API changes later
        setManagers(data.filter((m: any) => m.username !== 'Admin01'))
      }
    } catch (error) {
      console.error('Error fetching managers:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading league table...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  // Calculate league standings using computed totals across all phases
  const standings = managers
    .map(manager => {
      const totalPoints = manager.computedTotalPoints ?? 0
      const budgetRemaining = manager.budgetKGBP
      const recentGwPoints = manager.recentGwPoints ?? 0
      const wd = manager.wd ?? 0
      
      return {
        ...manager,
        totalPoints,
        budgetRemaining,
        recentGwPoints,
        wd,
      }
    })
    .sort((a, b) => b.totalPoints - a.totalPoints)

  const maxRecent = Math.max(...standings.map(s => s.recentGwPoints || 0))

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">League Table</h1>
              <p className="text-gray-600 mt-2">
                Current standings and manager statistics
              </p>
              {dataLastUpdated && (
                <p className="text-sm text-gray-500 mt-1">
                  Data last updated: {new Date(dataLastUpdated).toLocaleString()}
                </p>
              )}
            </div>
            <Button asChild variant="outline">
              <Link href="/dashboard">← Back to Dashboard</Link>
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Current Standings</CardTitle>
            <CardDescription>
              Rankings based on total points across all phases
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Position</TableHead>
                  <TableHead>Manager</TableHead>
                  <TableHead>GW {standings[0]?.recentGwId ?? '-'} Points</TableHead>
                  <TableHead>Total Points</TableHead>
                  <TableHead>WD</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {standings.map((manager, index) => (
                  <TableRow key={manager.id}>
                    <TableCell className="font-medium">
                      {index + 1}
                    </TableCell>
                    <TableCell>
                      <Link href={`/manager/${manager.id}`} className="font-medium text-blue-600 hover:text-blue-800 hover:underline">
                        {manager.username}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <span className={`text-lg font-bold ${manager.recentGwPoints === maxRecent ? 'text-green-700' : 'text-gray-900'}`}>
                        {manager.recentGwPoints}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-lg font-bold text-blue-600">
                        {manager.totalPoints}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={manager.wd > 0 ? "default" : manager.wd < 0 ? "destructive" : "outline"}>
                        {manager.wd > 0 ? `+${manager.wd}` : manager.wd}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
