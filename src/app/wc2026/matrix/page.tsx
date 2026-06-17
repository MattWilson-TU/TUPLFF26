'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface MatrixManager {
  id: string
  username: string
  totalPoints: number
  exactScores: number
}

interface MatrixFixture {
  id: string
  homeTeam: string
  awayTeam: string
  flags: string
  kickoffBst: string
  realScore: string
}

interface MatrixData {
  managers: MatrixManager[]
  fixtures: MatrixFixture[]
  cells: Record<string, Record<string, number>>
}

function pointCellClass(points: number): string {
  if (points === 3) return 'bg-green-500'
  if (points === 1) return 'bg-yellow-400'
  return 'bg-gray-300'
}

export default function Wc2026MatrixPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [matrix, setMatrix] = useState<MatrixData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [enrolled, setEnrolled] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/signin')
  }, [status, router])

  const loadData = useCallback(async () => {
    try {
      const participationRes = await fetch('/api/wc2026/participation')
      if (participationRes.ok) {
        const participation = await participationRes.json()
        if (!participation.enabled) {
          setEnrolled(false)
          router.push('/dashboard')
          return
        }
      }

      const res = await fetch('/api/wc2026/matrix')
      if (res.ok) setMatrix(await res.json())
    } catch (error) {
      console.error('Error loading matrix:', error)
    } finally {
      setIsLoading(false)
    }
  }, [router])

  useEffect(() => {
    if (session) loadData()
  }, [session, loadData])

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Loading matrix...</p>
        </div>
      </div>
    )
  }

  if (!session || !enrolled || !matrix) return null

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="container mx-auto px-4 py-6 sm:py-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Points Matrix</h1>
            <p className="text-sm text-gray-600 mt-2">
              Finished fixtures vs managers. Hover a cell for details.
            </p>
            <div className="flex flex-wrap gap-3 mt-3 text-xs text-gray-600">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-4 h-4 rounded-sm bg-green-500" /> 3 pts
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-4 h-4 rounded-sm bg-yellow-400" /> 1 pt
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-4 h-4 rounded-sm bg-gray-300" /> 0 pts
              </span>
            </div>
          </div>
          <Button asChild variant="outline" className="w-full sm:w-auto shrink-0">
            <Link href="/wc2026">← Back to Predictor</Link>
          </Button>
        </div>

        <Card>
          <CardHeader className="px-4 sm:px-6">
            <CardTitle>Results matrix</CardTitle>
            <CardDescription>
              {matrix.fixtures.length} finished fixtures · {matrix.managers.length} managers
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0 sm:px-2 pb-4">
            {matrix.fixtures.length === 0 ? (
              <p className="text-sm text-gray-600 px-4 sm:px-6">No finished matches yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className="sticky left-0 top-0 z-30 bg-gray-100 border-b border-r border-gray-200 p-2 w-14 min-w-14 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]" />
                      {matrix.managers.map((manager) => (
                        <th
                          key={manager.id}
                          className="sticky top-0 z-20 bg-gray-100 border-b border-gray-200 p-1 min-w-[2.25rem] max-w-[2.25rem]"
                        >
                          <Link
                            href={`/wc2026/managers/${manager.id}`}
                            className="block text-[10px] leading-tight font-medium text-blue-600 hover:underline [writing-mode:vertical-lr] max-h-24 truncate mx-auto py-1"
                            title={`${manager.username} (${manager.totalPoints} pts)`}
                          >
                            {manager.username}
                          </Link>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {matrix.fixtures.map((fixture) => (
                      <tr key={fixture.id} className="group">
                        <td
                          className="sticky left-0 z-10 bg-white border-r border-b border-gray-200 p-1 text-center text-lg leading-none w-14 min-w-14 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)] group-hover:bg-gray-50"
                          title={`${fixture.homeTeam} vs ${fixture.awayTeam} (${fixture.realScore})`}
                        >
                          {fixture.flags}
                        </td>
                        {matrix.managers.map((manager) => {
                          const points = matrix.cells[fixture.id]?.[manager.id] ?? 0
                          return (
                            <td
                              key={manager.id}
                              className="border-b border-gray-200 p-0.5"
                              title={`${manager.username}: ${fixture.homeTeam} vs ${fixture.awayTeam} — ${points} pts`}
                            >
                              <div
                                className={`w-8 h-8 rounded-sm mx-auto ${pointCellClass(points)}`}
                              />
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
