'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import Link from 'next/link'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface PlayerStats {
  id: number
  firstName: string
  secondName: string
  webName?: string
  elementType: 'GK' | 'DEF' | 'MID' | 'FWD'
  team: { name: string }
  totalPoints: number
  nowCostHalfM: number
  currentOwner?: {
    username: string
  }
}

interface ManagerStats {
  username: string
  name: string
  totalPoints: number
  gameweekPoints: Array<{
    gameweekId: number
    points: number
    cumulativePoints: number
  }>
}

interface TopPlayers {
  GK: PlayerStats[]
  DEF: PlayerStats[]
  MID: PlayerStats[]
  FWD: PlayerStats[]
}

export default function StatsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [topPlayers, setTopPlayers] = useState<TopPlayers>({ GK: [], DEF: [], MID: [], FWD: [] })
  const [auctionStatus, setAuctionStatus] = useState<string>('')
  const [managerStats, setManagerStats] = useState<ManagerStats[]>([])
  const [selectedManager1, setSelectedManager1] = useState<string>('')
  const [selectedManager2, setSelectedManager2] = useState<string>('')
  const [selectedManager3, setSelectedManager3] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
    }
  }, [status, router])

  useEffect(() => {
    if (status === 'authenticated') {
      fetchStats()
    }
  }, [status])

  const fetchStats = async () => {
    try {
      setIsLoading(true)
      
      // Fetch auction status
      const auctionRes = await fetch('/api/auction/current')
      if (auctionRes.ok) {
        const auctionData = await auctionRes.json()
        setAuctionStatus(auctionData.status || '')
      }
      
      // Fetch top players by position
      const playersRes = await fetch('/api/stats/top-players')
      if (playersRes.ok) {
        const playersData = await playersRes.json()
        setTopPlayers(playersData)
      }

      // Fetch manager stats
      const managersRes = await fetch('/api/stats/manager-performance')
      if (managersRes.ok) {
        const managersData = await managersRes.json()
        setManagerStats(managersData)
      }
    } catch (error) {
      console.error('Error fetching stats:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const getPositionColor = (position: string) => {
    switch (position) {
      case 'GK': return 'bg-green-100 text-green-800'
      case 'DEF': return 'bg-blue-100 text-blue-800'
      case 'MID': return 'bg-yellow-100 text-yellow-800'
      case 'FWD': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const formatPrice = (halfMillionUnits: number) => {
    return `£${(halfMillionUnits * 0.5).toFixed(1)}m`
  }


  // Get selected managers
  const selectedManagers = [selectedManager1, selectedManager2, selectedManager3].filter(Boolean)
  const filteredManagerStats = selectedManagers.length > 0
    ? managerStats.filter(m => selectedManagers.includes(m.username))
    : managerStats.slice(0, 3) // Default to first 3 managers if none selected

  // Find the latest gameweek with points across all managers
  const latestGameweekWithPoints = Math.max(
    ...managerStats.flatMap(m => 
      m.gameweekPoints
        .filter(gw => gw.points > 0)
        .map(gw => gw.gameweekId)
    ),
    0
  )

  // Create chart data with each manager as a separate line
  const chartData = []
  const gameweeks = Array.from({ length: latestGameweekWithPoints }, (_, i) => i + 1)
  
  for (const gw of gameweeks) {
    const dataPoint: any = { gameweek: `GW${gw}` }
    
    for (const manager of filteredManagerStats) {
      const gwData = manager.gameweekPoints.find(gwData => gwData.gameweekId === gw)
      dataPoint[manager.name] = gwData ? gwData.cumulativePoints : 0
    }
    
    chartData.push(dataPoint)
  }

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading statistics...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Statistics</h1>
              <p className="text-gray-600 mt-2">
                Player performance and manager analytics
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href="/dashboard">← Back to Dashboard</Link>
            </Button>
          </div>
        </div>

        {/* Top Players by Position */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-6">Top 5 Players by Position</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {(['GK', 'DEF', 'MID', 'FWD'] as const).map(position => (
              <Card key={position}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Badge className={getPositionColor(position)}>
                      {position}
                    </Badge>
                    <span className="text-lg">Top 5</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {topPlayers[position]?.slice(0, 5).map((player, index) => (
                      <div key={player.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <div className="flex-1">
                          <p className="font-medium text-sm">
                            {player.webName || `${player.firstName} ${player.secondName}`}
                          </p>
                          <p className="text-xs text-gray-600">{player.team.name}</p>
                          {player.currentOwner && (
                            <p className="text-xs text-blue-600">Owned by {player.currentOwner.username}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-green-600">{player.totalPoints} pts</p>
                          <p className="text-xs text-gray-500">{formatPrice(player.nowCostHalfM)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>


        {/* Manager Performance Chart */}
        <div className="mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Manager Performance Over Time</CardTitle>
              <CardDescription>
                Compare up to 3 managers' cumulative points across gameweeks
              </CardDescription>
              <div className="mt-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Manager 1</label>
                    <Select value={selectedManager1} onValueChange={setSelectedManager1}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select manager" />
                      </SelectTrigger>
                      <SelectContent>
                        {managerStats.map(manager => (
                          <SelectItem key={manager.username} value={manager.username}>
                            {manager.name} ({manager.username})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Manager 2</label>
                    <Select value={selectedManager2} onValueChange={setSelectedManager2}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select manager" />
                      </SelectTrigger>
                      <SelectContent>
                        {managerStats.map(manager => (
                          <SelectItem key={manager.username} value={manager.username}>
                            {manager.name} ({manager.username})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Manager 3</label>
                    <Select value={selectedManager3} onValueChange={setSelectedManager3}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select manager" />
                      </SelectTrigger>
                      <SelectContent>
                        {managerStats.map(manager => (
                          <SelectItem key={manager.username} value={manager.username}>
                            {manager.name} ({manager.username})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="gameweek" 
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }}
                      label={{ value: 'Cumulative Points', angle: -90, position: 'insideLeft' }}
                    />
                    <Tooltip 
                      formatter={(value, name) => [`${value} points`, name]}
                      labelFormatter={(label) => `Gameweek: ${label}`}
                    />
                    <Legend />
                    {filteredManagerStats.map((manager, index) => {
                      const colors = ['#8884d8', '#82ca9d', '#ffc658']
                      return (
                        <Line 
                          key={manager.username}
                          type="monotone" 
                          dataKey={manager.name}
                          stroke={colors[index % colors.length]}
                          strokeWidth={2}
                          name={manager.name}
                        />
                      )
                    })}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Manager Summary Table */}
        <div className="mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Manager Summary</CardTitle>
              <CardDescription>
                Current standings and performance metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Manager</th>
                      <th className="text-right p-2">Total Points</th>
                      <th className="text-right p-2">Avg per GW</th>
                      <th className="text-right p-2">Best GW</th>
                      <th className="text-right p-2">Worst GW</th>
                    </tr>
                  </thead>
                  <tbody>
                    {managerStats
                      .sort((a, b) => b.totalPoints - a.totalPoints)
                      .map((manager, index) => {
                        const avgPoints = manager.gameweekPoints.length > 0 
                          ? (manager.totalPoints / manager.gameweekPoints.length).toFixed(1)
                          : '0.0'
                        const bestGW = manager.gameweekPoints.length > 0
                          ? Math.max(...manager.gameweekPoints.map(gw => gw.points))
                          : 0
                        const worstGW = manager.gameweekPoints.length > 0
                          ? Math.min(...manager.gameweekPoints.map(gw => gw.points))
                          : 0

                        return (
                          <tr key={manager.username} className="border-b hover:bg-gray-50">
                            <td className="p-2">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-lg">#{index + 1}</span>
                                <div>
                                  <p className="font-medium">{manager.name}</p>
                                  <p className="text-sm text-gray-600">@{manager.username}</p>
                                </div>
                              </div>
                            </td>
                            <td className="text-right p-2 font-bold text-green-600">
                              {manager.totalPoints}
                            </td>
                            <td className="text-right p-2">{avgPoints}</td>
                            <td className="text-right p-2 text-green-600">{bestGW}</td>
                            <td className="text-right p-2 text-red-600">{worstGW}</td>
                          </tr>
                        )
                      })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
