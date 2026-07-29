'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

interface ManagerPerformance {
  username: string
  name: string
  totalPoints: number
  gameweekPoints: Array<{
    gameweekId: number
    points: number
    cumulativePoints: number
  }>
}

interface TopPlayer {
  id: number
  firstName: string
  secondName: string
  webName: string | null
  elementType: 'GK' | 'DEF' | 'MID' | 'FWD'
  totalPoints: number
  team: { name: string }
  currentOwner: { username: string } | null
}

type TopPlayersByPosition = Record<'GK' | 'DEF' | 'MID' | 'FWD', TopPlayer[]>

interface ChartGameweekPoint {
  gameweekId: number
  gameweekLabel: string
  [username: string]: string | number
}

const managerLineColors = ['#2563eb', '#16a34a', '#ea580c']

const positionLabels: Record<TopPlayer['elementType'], string> = {
  GK: 'Goalkeepers',
  DEF: 'Defenders',
  MID: 'Midfielders',
  FWD: 'Forwards',
}

const positionBadgeClass: Record<TopPlayer['elementType'], string> = {
  GK: 'bg-green-100 text-green-800',
  DEF: 'bg-blue-100 text-blue-800',
  MID: 'bg-yellow-100 text-yellow-800',
  FWD: 'bg-red-100 text-red-800',
}

function playerDisplayName(player: TopPlayer): string {
  return player.webName || `${player.firstName} ${player.secondName}`
}

export default function StatsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [managerPerformance, setManagerPerformance] = useState<ManagerPerformance[]>([])
  const [topPlayers, setTopPlayers] = useState<TopPlayersByPosition | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedManager1, setSelectedManager1] = useState<string>('')
  const [selectedManager2, setSelectedManager2] = useState<string>('')
  const [selectedManager3, setSelectedManager3] = useState<string>('')

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/signin')
  }, [status, router])

  const loadData = useCallback(async () => {
    try {
      const [performanceRes, topPlayersRes] = await Promise.all([
        fetch('/api/stats/manager-performance'),
        fetch('/api/stats/top-players'),
      ])

      if (performanceRes.ok) {
        const data: ManagerPerformance[] = await performanceRes.json()
        setManagerPerformance(data)
        setSelectedManager1(data[0]?.username ?? '')
        setSelectedManager2(data[1]?.username ?? '')
        setSelectedManager3(data[2]?.username ?? '')
      }

      if (topPlayersRes.ok) {
        setTopPlayers(await topPlayersRes.json())
      }
    } catch (error) {
      console.error('Error loading stats:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (session) loadData()
  }, [session, loadData])

  const selectedManagerUsernames = useMemo(
    () => [selectedManager1, selectedManager2, selectedManager3].filter(Boolean),
    [selectedManager1, selectedManager2, selectedManager3]
  )

  const selectedManagers = useMemo(() => {
    return selectedManagerUsernames
      .map((username) => managerPerformance.find((manager) => manager.username === username))
      .filter((manager): manager is ManagerPerformance => Boolean(manager))
  }, [managerPerformance, selectedManagerUsernames])

  const chartData = useMemo<ChartGameweekPoint[]>(() => {
    if (selectedManagers.length === 0) return []

    const gameweekIds = Array.from(
      new Set(
        selectedManagers.flatMap((manager) =>
          manager.gameweekPoints.map((entry) => entry.gameweekId)
        )
      )
    ).sort((a, b) => a - b)

    return gameweekIds.map((gameweekId) => {
      const point: ChartGameweekPoint = {
        gameweekId,
        gameweekLabel: `GW ${gameweekId}`,
      }

      for (const manager of selectedManagers) {
        const entry = manager.gameweekPoints.find((gw) => gw.gameweekId === gameweekId)
        point[manager.username] = entry?.cumulativePoints ?? 0
      }

      return point
    })
  }, [selectedManagers])

  const latestGameweekPoints = useMemo(() => {
    if (managerPerformance.length === 0) return []

    const latestGameweekId = Math.max(
      ...managerPerformance.flatMap((manager) =>
        manager.gameweekPoints.map((entry) => entry.gameweekId)
      ),
      0
    )

    if (latestGameweekId === 0) return []

    return managerPerformance
      .map((manager) => {
        const latest = manager.gameweekPoints.find((entry) => entry.gameweekId === latestGameweekId)
        return {
          username: manager.username,
          name: manager.name,
          points: latest?.points ?? 0,
        }
      })
      .sort((a, b) => b.points - a.points)
  }, [managerPerformance])

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

  if (!session) return null

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="container mx-auto px-4 py-6 sm:py-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Statistics</h1>
            <p className="text-sm text-gray-600 mt-2">
              Fantasy league performance, cumulative points, and top players by position.
            </p>
          </div>
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href="/dashboard">← Back to Dashboard</Link>
          </Button>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Cumulative Points by Gameweek</CardTitle>
            <CardDescription>
              Select up to three managers to compare their season progress.
            </CardDescription>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
              <Select value={selectedManager1} onValueChange={setSelectedManager1}>
                <SelectTrigger>
                  <SelectValue placeholder="Select manager 1" />
                </SelectTrigger>
                <SelectContent>
                  {managerPerformance.map((manager) => (
                    <SelectItem key={`m1-${manager.username}`} value={manager.username}>
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
                  {managerPerformance.map((manager) => (
                    <SelectItem key={`m2-${manager.username}`} value={manager.username}>
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
                  {managerPerformance.map((manager) => (
                    <SelectItem key={`m3-${manager.username}`} value={manager.username}>
                      {manager.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-96">
              {chartData.length === 0 ? (
                <p className="text-sm text-gray-600">No gameweek data available yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="gameweekLabel" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                    <Tooltip
                      formatter={(value, name) => [`${value} pts`, name]}
                      labelFormatter={(_, payload) => {
                        const row = payload?.[0]?.payload as ChartGameweekPoint | undefined
                        return row ? `Gameweek ${row.gameweekId}` : 'Gameweek'
                      }}
                    />
                    <Legend />
                    {selectedManagers.map((manager, index) => (
                      <Line
                        key={manager.username}
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
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardHeader>
              <CardTitle>Latest Gameweek Scores</CardTitle>
              <CardDescription>Points scored in the most recent gameweek with data.</CardDescription>
            </CardHeader>
            <CardContent>
              {latestGameweekPoints.length === 0 ? (
                <p className="text-sm text-gray-600">No gameweek data available yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Manager</TableHead>
                      <TableHead className="text-right">Points</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {latestGameweekPoints.map((manager) => (
                      <TableRow key={manager.username}>
                        <TableCell>
                          <div className="font-medium">{manager.username}</div>
                          <div className="text-xs text-gray-500">{manager.name}</div>
                        </TableCell>
                        <TableCell className="text-right font-semibold">{manager.points}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Season Totals</CardTitle>
              <CardDescription>Current total points for active managers.</CardDescription>
            </CardHeader>
            <CardContent>
              {managerPerformance.length === 0 ? (
                <p className="text-sm text-gray-600">No manager data available yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Manager</TableHead>
                      <TableHead className="text-right">Total Points</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...managerPerformance]
                      .sort((a, b) => b.totalPoints - a.totalPoints)
                      .map((manager) => (
                        <TableRow key={manager.username}>
                          <TableCell>
                            <div className="font-medium">{manager.username}</div>
                            <div className="text-xs text-gray-500">{manager.name}</div>
                          </TableCell>
                          <TableCell className="text-right font-semibold">{manager.totalPoints}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {(['GK', 'DEF', 'MID', 'FWD'] as const).map((position) => (
            <Card key={position}>
              <CardHeader>
                <CardTitle>{positionLabels[position]}</CardTitle>
                <CardDescription>Top 5 players by total points.</CardDescription>
              </CardHeader>
              <CardContent>
                {!topPlayers || topPlayers[position].length === 0 ? (
                  <p className="text-sm text-gray-600">No player data available yet.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Player</TableHead>
                        <TableHead>Team</TableHead>
                        <TableHead>Owner</TableHead>
                        <TableHead className="text-right">Pts</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topPlayers[position].map((player) => (
                        <TableRow key={player.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{playerDisplayName(player)}</span>
                              <Badge className={positionBadgeClass[position]}>{position}</Badge>
                            </div>
                          </TableCell>
                          <TableCell>{player.team.name}</TableCell>
                          <TableCell>{player.currentOwner?.username ?? '—'}</TableCell>
                          <TableCell className="text-right font-semibold">{player.totalPoints}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
