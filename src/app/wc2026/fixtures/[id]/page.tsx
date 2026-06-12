'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { hasResult } from '@/lib/wc2026-scoring'

interface FixtureDetail {
  id: string
  homeTeam: string
  awayTeam: string
  homeCrest: string | null
  awayCrest: string | null
  kickoffBst: string
  stageLabel: string
  status: string
  finished: boolean
  homeScore90: number | null
  awayScore90: number | null
}

interface ManagerRow {
  id: string
  name: string
  username: string
  prediction: { homeScore: number; awayScore: number } | null
  missed: boolean
  points: number | null
}

function getPointsBadgeClass(points: number): string {
  if (points === 3) return 'bg-green-600'
  if (points === 1) return 'bg-yellow-400 text-yellow-950 hover:bg-yellow-400'
  return 'bg-gray-400 hover:bg-gray-400'
}

export default function Wc2026FixturePage({ params }: { params: Promise<{ id: string }> }) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [fixtureId, setFixtureId] = useState('')
  const [fixture, setFixture] = useState<FixtureDetail | null>(null)
  const [managers, setManagers] = useState<ManagerRow[]>([])
  const [showPoints, setShowPoints] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    params.then((p) => setFixtureId(p.id))
  }, [params])

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/signin')
  }, [status, router])

  useEffect(() => {
    async function loadFixture() {
      try {
        const res = await fetch(`/api/wc2026/fixtures/${fixtureId}`)
        if (res.status === 401) {
          router.push('/auth/signin')
          return
        }
        if (res.status === 403 || res.status === 404) {
          router.push('/wc2026')
          return
        }
        if (!res.ok) throw new Error('Failed to load fixture')

        const data = await res.json()
        setFixture(data.fixture)
        setManagers(data.managers)
        setShowPoints(data.showPoints)
      } catch (error) {
        console.error('Error loading fixture:', error)
        router.push('/wc2026')
      } finally {
        setLoading(false)
      }
    }

    if (fixtureId && status === 'authenticated') {
      loadFixture()
    }
  }, [fixtureId, router, status])

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Loading fixture...</p>
        </div>
      </div>
    )
  }

  if (!session || !fixture) return null

  const resultKnown = hasResult(fixture.homeScore90, fixture.awayScore90)
  const inProgress = !resultKnown && fixture.status !== 'FINISHED'

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="container mx-auto px-4 py-6 sm:py-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Fixture Predictions</h1>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <Badge variant="outline">{fixture.stageLabel}</Badge>
              {resultKnown ? (
                <Badge variant="secondary">Finished</Badge>
              ) : inProgress ? (
                <Badge variant="destructive">In progress</Badge>
              ) : (
                <Badge variant="destructive">Locked</Badge>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-2">{fixture.kickoffBst} BST</p>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2 text-sm sm:text-base">
              {fixture.homeCrest && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={fixture.homeCrest} alt="" className="h-5 w-5 sm:h-6 sm:w-6 object-contain shrink-0" />
              )}
              <span className="font-medium">{fixture.homeTeam}</span>
              {resultKnown ? (
                <>
                  <span className="font-bold text-lg tabular-nums text-gray-900">{fixture.homeScore90}</span>
                  <span className="text-gray-400 shrink-0">–</span>
                  <span className="font-bold text-lg tabular-nums text-gray-900">{fixture.awayScore90}</span>
                </>
              ) : (
                <span className="text-gray-400 shrink-0">vs</span>
              )}
              <span className="font-medium">{fixture.awayTeam}</span>
              {fixture.awayCrest && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={fixture.awayCrest} alt="" className="h-5 w-5 sm:h-6 sm:w-6 object-contain shrink-0" />
              )}
            </div>
            {resultKnown && (
              <p className="text-xs text-gray-500 mt-1">Result after 90 minutes</p>
            )}
          </div>
          <Button asChild variant="outline" className="w-full sm:w-auto shrink-0">
            <Link href="/wc2026">← Back to WC2026</Link>
          </Button>
        </div>

        <Card>
          <CardHeader className="px-4 sm:px-6">
            <CardTitle>Manager Predictions</CardTitle>
            <CardDescription>
              {showPoints
                ? 'Points awarded after the final result (3 pts exact score, 1 pt correct outcome)'
                : 'All manager predictions for this fixture. Points will appear once the result is confirmed.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 sm:px-6">
            {managers.length === 0 ? (
              <p className="text-sm text-gray-600">No managers found.</p>
            ) : (
              <div className="overflow-x-auto -mx-4 sm:-mx-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {showPoints && <TableHead className="w-12">Pos</TableHead>}
                      <TableHead>Manager</TableHead>
                      <TableHead>Prediction</TableHead>
                      {showPoints && <TableHead className="text-right">Points</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {managers.map((manager, index) => (
                      <TableRow key={manager.id}>
                        {showPoints && (
                          <TableCell className="font-medium">{index + 1}</TableCell>
                        )}
                        <TableCell className="max-w-[8rem] sm:max-w-none truncate">
                          {manager.username}
                        </TableCell>
                        <TableCell>
                          {manager.prediction ? (
                            <span className="tabular-nums">
                              {manager.prediction.homeScore} – {manager.prediction.awayScore}
                            </span>
                          ) : (
                            <span className="text-gray-500">No prediction — 0 pts</span>
                          )}
                        </TableCell>
                        {showPoints && (
                          <TableCell className="text-right">
                            <Badge className={getPointsBadgeClass(manager.points ?? 0)}>
                              {manager.points} pts
                            </Badge>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
