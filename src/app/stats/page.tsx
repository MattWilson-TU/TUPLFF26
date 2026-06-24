'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { WcFixtureLine } from '@/components/wc2026-fixture-line'

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
  homeCrest: string | null
  awayCrest: string | null
  homeScore90: number
  awayScore90: number
  kickoffBst: string
  kickoffUtc: string
}

interface MatrixData {
  managers: MatrixManager[]
  fixtures: MatrixFixture[]
  cells: Record<string, Record<string, number>>
}

interface ChartDayPoint {
  day: string
  dayLabel: string
  [username: string]: string | number
}

const managerLineColors = ['#2563eb', '#16a34a', '#ea580c']

function pointCellClass(points: number): string {
  if (points === 3) return 'bg-green-500'
  if (points === 1) return 'bg-yellow-400'
  return 'bg-gray-300'
}

function buildLosAngelesDay(utcIso: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(utcIso))

  const year = parts.find((part) => part.type === 'year')?.value ?? '0000'
  const month = parts.find((part) => part.type === 'month')?.value ?? '00'
  const day = parts.find((part) => part.type === 'day')?.value ?? '00'

  return `${year}-${month}-${day}`
}

function formatLosAngelesDay(day: string): string {
  const [year, month, date] = day.split('-')
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(date))).toLocaleDateString('en-US', {
    timeZone: 'America/Los_Angeles',
    month: 'short',
    day: 'numeric',
  })
}

export default function StatsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [matrix, setMatrix] = useState<MatrixData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [enrolled, setEnrolled] = useState(true)
  const [selectedManager1, setSelectedManager1] = useState<string>('')
  const [selectedManager2, setSelectedManager2] = useState<string>('')
  const [selectedManager3, setSelectedManager3] = useState<string>('')

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

      const matrixRes = await fetch('/api/wc2026/matrix')
      if (matrixRes.ok) {
        const data: MatrixData = await matrixRes.json()
        setMatrix(data)
        setSelectedManager1(data.managers[0]?.username ?? '')
        setSelectedManager2(data.managers[1]?.username ?? '')
        setSelectedManager3(data.managers[2]?.username ?? '')
      }
    } catch (error) {
      console.error('Error loading stats:', error)
    } finally {
      setIsLoading(false)
    }
  }, [router])

  useEffect(() => {
    if (session) loadData()
  }, [session, loadData])

  const selectedManagerUsernames = useMemo(
    () => [selectedManager1, selectedManager2, selectedManager3].filter(Boolean),
    [selectedManager1, selectedManager2, selectedManager3]
  )

  const selectedManagers = useMemo(() => {
    if (!matrix) return []
    return selectedManagerUsernames
      .map((username) => matrix.managers.find((manager) => manager.username === username))
      .filter((manager): manager is MatrixManager => Boolean(manager))
  }, [matrix, selectedManagerUsernames])

  const chartData = useMemo<ChartDayPoint[]>(() => {
    if (!matrix || selectedManagers.length === 0 || matrix.fixtures.length === 0) return []

    const fixturesByDay = new Map<string, MatrixFixture[]>()
    for (const fixture of matrix.fixtures) {
      const day = buildLosAngelesDay(fixture.kickoffUtc)
      const list = fixturesByDay.get(day) ?? []
      list.push(fixture)
      fixturesByDay.set(day, list)
    }

    const days = Array.from(fixturesByDay.keys()).sort()
    const cumulative = new Map<string, number>(selectedManagers.map((manager) => [manager.id, 0]))

    return days.map((day) => {
      const point: ChartDayPoint = { day, dayLabel: formatLosAngelesDay(day) }
      const dayFixtures = fixturesByDay.get(day) ?? []

      for (const manager of selectedManagers) {
        const dayPoints = dayFixtures.reduce((sum, fixture) => {
          return sum + (matrix.cells[fixture.id]?.[manager.id] ?? 0)
        }, 0)
        const nextTotal = (cumulative.get(manager.id) ?? 0) + dayPoints
        cumulative.set(manager.id, nextTotal)
        point[manager.username] = nextTotal
      }

      return point
    })
  }, [matrix, selectedManagers])

  const managerChoices = matrix?.managers ?? []

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Loading stats...</p>
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
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Stats</h1>
            <p className="text-sm text-gray-600 mt-2">
              Points matrix and cumulative points by day (America/Los_Angeles kickoff date).
            </p>
          </div>
          <div className="flex flex-col gap-2 w-full sm:w-auto">
            <Button asChild variant="outline" className="w-full sm:w-auto">
              <Link href="/wc2026">← Back to Predictor</Link>
            </Button>
            <Button asChild variant="outline" className="w-full sm:w-auto">
              <Link href="/dashboard">← Back to Dashboard</Link>
            </Button>
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Cumulative Points by Day</CardTitle>
            <CardDescription>
              Select up to three managers. Each day is based on fixture kickoff date in Los Angeles.
            </CardDescription>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
              <Select value={selectedManager1} onValueChange={setSelectedManager1}>
                <SelectTrigger>
                  <SelectValue placeholder="Select manager 1" />
                </SelectTrigger>
                <SelectContent>
                  {managerChoices.map((manager) => (
                    <SelectItem key={`m1-${manager.id}`} value={manager.username}>
                      {manager.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedManager2} onValueChange={setSelectedManager2}>
                <SelectTrigger>
                  <SelectValue placeholder="Select manager 2" />
                </SelectTrigger>
                <SelectContent>
                  {managerChoices.map((manager) => (
                    <SelectItem key={`m2-${manager.id}`} value={manager.username}>
                      {manager.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedManager3} onValueChange={setSelectedManager3}>
                <SelectTrigger>
                  <SelectValue placeholder="Select manager 3" />
                </SelectTrigger>
                <SelectContent>
                  {managerChoices.map((manager) => (
                    <SelectItem key={`m3-${manager.id}`} value={manager.username}>
                      {manager.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="dayLabel" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip
                    formatter={(value, name) => [`${value} pts`, name]}
                    labelFormatter={(_, payload) => {
                      const row = payload?.[0]?.payload as ChartDayPoint | undefined
                      return row ? `LA day: ${row.day}` : 'LA day'
                    }}
                  />
                  <Legend />
                  {selectedManagers.map((manager, index) => (
                    <Line
                      key={manager.id}
                      type="monotone"
                      dataKey={manager.username}
                      stroke={managerLineColors[index % managerLineColors.length]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="px-4 sm:px-6">
            <CardTitle>Points Matrix</CardTitle>
            <CardDescription>
              {matrix.fixtures.length} finished fixtures · {matrix.managers.length} managers
            </CardDescription>
            <div className="flex flex-wrap gap-3 text-xs text-gray-600">
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
          </CardHeader>
          <CardContent className="px-0 sm:px-2 pb-4">
            {matrix.fixtures.length === 0 ? (
              <p className="text-sm text-gray-600 px-4 sm:px-6">No finished matches yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className="sticky left-0 top-0 z-30 bg-gray-100 border-b border-r border-gray-200 p-2 w-[5.5rem] min-w-[5.5rem] shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]" />
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
                          className="sticky left-0 z-10 bg-white border-r border-b border-gray-200 p-1 w-[5.5rem] min-w-[5.5rem] shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)] group-hover:bg-gray-50"
                          title={`${fixture.homeTeam} vs ${fixture.awayTeam} (${fixture.homeScore90}-${fixture.awayScore90})`}
                        >
                          <WcFixtureLine
                            variant="compact"
                            homeTeam={fixture.homeTeam}
                            awayTeam={fixture.awayTeam}
                            homeCrest={fixture.homeCrest}
                            awayCrest={fixture.awayCrest}
                            homeScore90={fixture.homeScore90}
                            awayScore90={fixture.awayScore90}
                          />
                        </td>
                        {matrix.managers.map((manager) => {
                          const points = matrix.cells[fixture.id]?.[manager.id] ?? 0
                          return (
                            <td
                              key={manager.id}
                              className="border-b border-gray-200 p-0.5"
                              title={`${manager.username}: ${fixture.homeTeam} vs ${fixture.awayTeam} - ${points} pts`}
                            >
                              <div className={`w-8 h-8 rounded-sm mx-auto ${pointCellClass(points)}`} />
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
