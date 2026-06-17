'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface ManagerInfo {
  id: string
  name: string
  username: string
}

interface ResultRow {
  fixtureId: string
  homeTeam: string
  awayTeam: string
  homeCrest: string | null
  awayCrest: string | null
  kickoffBst: string
  stageLabel: string
  realScore: string
  predictedScore: string | null
  missed: boolean
  points: number
}

function getPointsBadgeClass(points: number): string {
  if (points === 3) return 'bg-green-600'
  if (points === 1) return 'bg-yellow-400 text-yellow-950 hover:bg-yellow-400'
  return 'bg-gray-400 hover:bg-gray-400'
}

function getRowClass(points: number, missed: boolean): string {
  if (points === 3) return 'bg-green-50'
  if (points === 1) return 'bg-yellow-50'
  if (missed || points === 0) return 'bg-gray-50'
  return ''
}

export default function Wc2026ManagerPage({ params }: { params: Promise<{ id: string }> }) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [managerId, setManagerId] = useState('')
  const [manager, setManager] = useState<ManagerInfo | null>(null)
  const [totalPoints, setTotalPoints] = useState(0)
  const [exactScores, setExactScores] = useState(0)
  const [results, setResults] = useState<ResultRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    params.then((p) => setManagerId(p.id))
  }, [params])

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/signin')
  }, [status, router])

  useEffect(() => {
    if (!managerId) return

    async function loadManager() {
      try {
        const res = await fetch(`/api/wc2026/managers/${managerId}/predictions`)
        if (res.status === 401) {
          router.push('/auth/signin')
          return
        }
        if (res.status === 403 || res.status === 404) {
          router.push('/wc2026')
          return
        }
        if (!res.ok) throw new Error('Failed to load manager predictions')

        const data = await res.json()
        setManager(data.manager)
        setTotalPoints(data.totalPoints)
        setExactScores(data.exactScores)
        setResults(data.results)
      } catch (error) {
        console.error('Error loading manager predictions:', error)
        router.push('/wc2026')
      } finally {
        setLoading(false)
      }
    }

    if (session) loadManager()
  }, [managerId, session, router])

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Loading predictions...</p>
        </div>
      </div>
    )
  }

  if (!session || !manager) return null

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="container mx-auto px-4 py-6 sm:py-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{manager.username}</h1>
            <p className="text-sm text-gray-600 mt-1">
              {totalPoints} pts
              {exactScores > 0 && ` · ${exactScores} exact`}
            </p>
          </div>
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href="/wc2026">← Back to Predictor</Link>
          </Button>
        </div>

        <Card>
          <CardHeader className="px-4 sm:px-6">
            <CardTitle>Prediction results</CardTitle>
            <CardDescription>Finished matches only — prediction vs actual score.</CardDescription>
          </CardHeader>
          <CardContent className="px-4 sm:px-6">
            {results.length === 0 ? (
              <p className="text-sm text-gray-600">No finished matches yet.</p>
            ) : (
              <div className="overflow-x-auto -mx-4 sm:-mx-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Home</TableHead>
                      <TableHead>Away</TableHead>
                      <TableHead className="text-center whitespace-nowrap">Real</TableHead>
                      <TableHead className="text-center whitespace-nowrap">Predicted</TableHead>
                      <TableHead className="text-right">Pts</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((row) => (
                      <TableRow key={row.fixtureId} className={getRowClass(row.points, row.missed)}>
                        <TableCell className="font-medium">{row.homeTeam}</TableCell>
                        <TableCell className="font-medium">{row.awayTeam}</TableCell>
                        <TableCell className="text-center">{row.realScore}</TableCell>
                        <TableCell className="text-center">
                          {row.missed ? (
                            <span className="text-gray-500">Missed</span>
                          ) : (
                            row.predictedScore
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge className={getPointsBadgeClass(row.points)}>{row.points}</Badge>
                        </TableCell>
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
