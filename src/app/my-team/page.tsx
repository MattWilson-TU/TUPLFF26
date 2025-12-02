'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

type GridPlayer = {
  id: number
  firstName: string
  secondName: string
  webName?: string
  elementType: 'GK'|'DEF'|'MID'|'FWD'
  team: { name: string }
  priceHalfM: number
  phasePoints: { 1: number; 2: number; 3: number; 4: number }
  totalPoints: number
  lastPhase?: number
  weeklyData?: Array<{ gameweekId: number; points: number; counted: boolean }>
}

export default function MyTeamPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [currentPlayers, setCurrentPlayers] = useState<GridPlayer[]>([])
  const [formerPlayers, setFormerPlayers] = useState<GridPlayer[]>([])
  const [phaseScores, setPhaseScores] = useState<{ phase: number; totalPoints: number }[]>([])
  const [currentPhase, setCurrentPhase] = useState<number>(1)
  const [loading, setLoading] = useState(true)
  const [auctionStatus, setAuctionStatus] = useState<'OPEN' | 'CLOSED' | null>(null)
  const [allPlayers, setAllPlayers] = useState<GridPlayer[]>([])
  const [allGameweekIds, setAllGameweekIds] = useState<number[]>([])
  const [activeTab, setActiveTab] = useState<'squad' | 'weekly'>('squad')

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/signin')
  }, [status, router])

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/my-team')
        if (res.ok) {
          const data = await res.json()
          setCurrentPlayers(data.currentPlayers || [])
          setFormerPlayers(data.formerPlayers || [])
          setPhaseScores(data.phaseScores || [])
          setCurrentPhase(data.currentPhase || 1)
          setAllPlayers(data.allPlayers || [])
          setAllGameweekIds(data.allGameweekIds || [])
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  useEffect(() => {
    async function loadAuctionStatus() {
      const res = await fetch('/api/auction/current')
      if (res.ok) {
        const data = await res.json()
        setAuctionStatus(data.auction?.status || null)
      }
    }
    loadAuctionStatus()
  }, [])

  const getPositionColor = (pos: string) => {
    switch (pos) {
      case 'GK': return 'bg-green-100 text-green-800'
      case 'DEF': return 'bg-blue-100 text-blue-800'
      case 'MID': return 'bg-yellow-100 text-yellow-800'
      case 'FWD': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading team...</p>
        </div>
      </div>
    )
  }

  if (!session) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">My Team</h1>
          <p className="text-gray-600">Phase scores and squad (Phase {currentPhase} active)</p>
        </div>

        {/* Auction Summary - Show when auction is closed */}
        {auctionStatus === 'CLOSED' && currentPlayers.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                🏆 Auction Complete - Your Squad
              </CardTitle>
              <CardDescription>
                Congratulations! You successfully acquired {currentPlayers.length} players in the auction.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                {currentPlayers.map((player) => (
                  <div key={player.id} className="border rounded-lg p-3 bg-gray-50">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium text-sm">
                        {player.webName || `${player.firstName} ${player.secondName}`}
                      </h3>
                      <Badge className={`text-xs ${getPositionColor(player.elementType)}`}>
                        {player.elementType}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-600 mb-1">{player.team.name}</p>
                    <p className="text-xs font-medium text-green-600">
                      £{(player.priceHalfM * 0.5).toFixed(1)}m
                    </p>
                  </div>
                ))}
              </div>
              <div className="pt-4 border-t">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Total Spent:</span>
                  <span className="text-lg font-bold text-green-600">
                    £{(currentPlayers.reduce((sum, p) => sum + (p.priceHalfM * 0.5), 0)).toFixed(1)}m
                  </span>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-sm font-medium">Remaining Budget:</span>
                  <span className="text-lg font-bold text-blue-600">
                    £{(150 - currentPlayers.reduce((sum, p) => sum + (p.priceHalfM * 0.5), 0)).toFixed(1)}m
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Phase Scores</CardTitle>
            <CardDescription>Total points per phase</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[1,2,3,4].map(phase => {
                const ps = phaseScores.find(p => p.phase === phase)?.totalPoints || 0
                return (
                  <div key={phase} className="p-3 border rounded">
                    <p className="text-sm text-gray-600">Phase {phase}</p>
                    <p className="text-xl font-semibold">{ps}</p>
                  </div>
                )
              })}
              <div className="p-3 border rounded bg-gray-50">
                <p className="text-sm text-gray-600">Total</p>
                <p className="text-xl font-semibold">
                  {phaseScores.reduce((sum, p) => sum + (p.totalPoints || 0), 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>My Squad</CardTitle>
            <CardDescription>View your squad and weekly performance</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Tabs */}
            <div className="flex gap-2 mb-6 border-b">
              <button
                onClick={() => setActiveTab('squad')}
                className={`px-4 py-2 font-medium transition-colors ${
                  activeTab === 'squad'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Squad View
              </button>
              <button
                onClick={() => setActiveTab('weekly')}
                className={`px-4 py-2 font-medium transition-colors ${
                  activeTab === 'weekly'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Weekly Scores
              </button>
            </div>

            {/* Squad View Tab */}
            {activeTab === 'squad' && (
              <>
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-2">Current Squad (Phase {currentPhase})</h3>
                  <p className="text-sm text-gray-600 mb-4">Players who score points for you</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-600">
                          <th className="p-2">Player</th>
                          <th className="p-2">Pos</th>
                          <th className="p-2">Value</th>
                          <th className="p-2">P1</th>
                          <th className="p-2">P2</th>
                          <th className="p-2">P3</th>
                          <th className="p-2">P4</th>
                          <th className="p-2">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentPlayers
                          .slice()
                          .sort((a,b) => {
                            const order: Record<string, number> = { GK: 0, DEF: 1, MID: 2, FWD: 3 }
                            const pc = order[a.elementType] - order[b.elementType]
                            if (pc !== 0) return pc
                            return (a.webName || a.secondName).localeCompare(b.webName || b.secondName)
                          })
                          .map(p => (
                            <tr key={p.id} className="border-t">
                              <td className="p-2">{p.firstName} {p.secondName} ({p.webName || p.secondName})</td>
                              <td className="p-2">
                                <Badge className={getPositionColor(p.elementType)}>{p.elementType}</Badge>
                              </td>
                              <td className="p-2">£{(p.priceHalfM * 0.5).toFixed(1)}m</td>
                              <td className="p-2">{p.phasePoints[1]}</td>
                              <td className="p-2">{p.phasePoints[2]}</td>
                              <td className="p-2">{p.phasePoints[3]}</td>
                              <td className="p-2">{p.phasePoints[4]}</td>
                              <td className="p-2 font-semibold">{p.totalPoints}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {formerPlayers.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Former Players</h3>
                    <p className="text-sm text-gray-600 mb-4">Players who no longer score points for you</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-gray-600">
                            <th className="p-2">Player</th>
                            <th className="p-2">Pos</th>
                            <th className="p-2">Value</th>
                            <th className="p-2">Last Phase</th>
                            <th className="p-2">P1</th>
                            <th className="p-2">P2</th>
                            <th className="p-2">P3</th>
                            <th className="p-2">P4</th>
                            <th className="p-2">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {formerPlayers
                            .slice()
                            .sort((a,b) => {
                              const order: Record<string, number> = { GK: 0, DEF: 1, MID: 2, FWD: 3 }
                              const pc = order[a.elementType] - order[b.elementType]
                              if (pc !== 0) return pc
                              return (a.webName || a.secondName).localeCompare(b.webName || b.secondName)
                            })
                            .map(p => (
                              <tr key={p.id} className="border-t">
                                <td className="p-2">{p.firstName} {p.secondName} ({p.webName || p.secondName})</td>
                                <td className="p-2">
                                  <Badge className={getPositionColor(p.elementType)}>{p.elementType}</Badge>
                                </td>
                                <td className="p-2">£{(p.priceHalfM * 0.5).toFixed(1)}m</td>
                                <td className="p-2">
                                  <Badge variant="outline">Phase {p.lastPhase}</Badge>
                                </td>
                                <td className="p-2">{p.phasePoints[1]}</td>
                                <td className="p-2">{p.phasePoints[2]}</td>
                                <td className="p-2">{p.phasePoints[3]}</td>
                                <td className="p-2">{p.phasePoints[4]}</td>
                                <td className="p-2 font-semibold">{p.totalPoints}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Weekly Scores Tab */}
            {activeTab === 'weekly' && (
              <div>
                <h3 className="text-lg font-semibold mb-2">Weekly Scores by Player</h3>
                <p className="text-sm text-gray-600 mb-4">
                  All players owned across all phases. Green highlights indicate weeks where points counted towards your total.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="text-left text-gray-600 bg-gray-50">
                        <th className="p-2 sticky left-0 bg-gray-50 z-10 border-r">Player</th>
                        <th className="p-2 sticky left-[180px] bg-gray-50 z-10 border-r">Pos</th>
                        {allGameweekIds.map(gwId => (
                          <th key={gwId} className="p-2 text-center min-w-[45px] border-r">GW{gwId}</th>
                        ))}
                        <th className="p-2 text-center bg-gray-100">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allPlayers
                        .slice()
                        .sort((a,b) => {
                          const order: Record<string, number> = { GK: 0, DEF: 1, MID: 2, FWD: 3 }
                          const pc = order[a.elementType] - order[b.elementType]
                          if (pc !== 0) return pc
                          return (a.webName || a.secondName).localeCompare(b.webName || b.secondName)
                        })
                        .map(p => {
                          const weeklyDataMap = new Map(
                            (p.weeklyData || []).map(wd => [wd.gameweekId, wd])
                          )
                          const totalCounted = (p.weeklyData || []).reduce((sum, wd) => sum + (wd.counted ? wd.points : 0), 0)
                          
                          return (
                            <tr key={p.id} className="border-t group hover:bg-gray-50">
                              <td className="p-2 sticky left-0 bg-white group-hover:bg-gray-50 z-10 font-medium border-r whitespace-nowrap">
                                {p.firstName} {p.secondName}
                                {p.webName && ` (${p.webName})`}
                              </td>
                              <td className="p-2 sticky left-[180px] bg-white group-hover:bg-gray-50 z-10 border-r">
                                <Badge className={getPositionColor(p.elementType)}>{p.elementType}</Badge>
                              </td>
                              {allGameweekIds.map(gwId => {
                                const wd = weeklyDataMap.get(gwId)
                                const points = wd?.points || 0
                                const counted = wd?.counted || false
                                
                                return (
                                  <td
                                    key={gwId}
                                    className={`p-2 text-center border-r ${
                                      counted && points > 0
                                        ? 'bg-green-100 text-green-800 font-semibold'
                                        : counted
                                        ? 'bg-green-50 text-gray-600'
                                        : points > 0
                                        ? 'text-gray-400'
                                        : 'text-gray-300'
                                    }`}
                                  >
                                    {points > 0 ? points : '-'}
                                  </td>
                                )
                              })}
                              <td className="p-2 text-center font-semibold bg-gray-50">
                                {totalCounted}
                              </td>
                            </tr>
                          )
                        })}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 text-xs text-gray-500">
                  <p>• Green cells indicate weeks where points counted towards your total</p>
                  <p>• Light green cells indicate weeks where player was owned but scored 0 points</p>
                  <p>• Gray cells indicate weeks where player was not owned</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}


