'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

type ManagerPlayer = {
  id: number
  firstName: string
  secondName: string
  webName?: string
  elementType: 'GK'|'DEF'|'MID'|'FWD'
  team: { name: string }
  priceHalfM: number
  phasePoints: { 1: number; 2: number; 3: number; 4: number }
  totalPoints: number
}

type ManagerData = {
  id: string
  name: string
  username: string
  currentPlayers: ManagerPlayer[]
  formerPlayers: ManagerPlayer[]
  phaseScores: Array<{ phase: number; totalPoints: number }>
  currentPhase: number
}

export default function ManagerTeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [managerData, setManagerData] = useState<ManagerData | null>(null)
  const [loading, setLoading] = useState(true)
  const [id, setId] = useState<string>('')

  useEffect(() => {
    params.then(p => setId(p.id))
  }, [params])

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/signin')
  }, [status, router])

  useEffect(() => {
    async function loadManagerData() {
      try {
        const res = await fetch(`/api/manager/${id}`, {
          credentials: 'include'
        })
        if (res.ok) {
          const data = await res.json()
          setManagerData(data)
        } else if (res.status === 404) {
          router.push('/league')
        } else if (res.status === 401) {
          router.push('/auth/signin')
        }
      } catch (error) {
        console.error('Error fetching manager data:', error)
        router.push('/league')
      } finally {
        setLoading(false)
      }
    }
    if (id && status === 'authenticated') {
      loadManagerData()
    }
  }, [id, router, status])

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
          <p className="mt-4 text-gray-600">Loading manager team...</p>
        </div>
      </div>
    )
  }

  if (!session || !managerData) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">{managerData.username}'s Team</h1>
              <p className="text-gray-600">Current squad and performance (Phase {managerData.currentPhase} active)</p>
            </div>
            <Button asChild variant="outline">
              <Link href="/dashboard">← Back to Dashboard</Link>
            </Button>
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Phase Scores</CardTitle>
            <CardDescription>Total points per phase</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[1,2,3,4].map(phase => {
                const ps = managerData.phaseScores.find(p => p.phase === phase)?.totalPoints || 0
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
                  {managerData.phaseScores.reduce((sum, p) => sum + (p.totalPoints || 0), 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Current Squad (Phase {managerData.currentPhase})</CardTitle>
            <CardDescription>Players who score points for {managerData.username}</CardDescription>
          </CardHeader>
          <CardContent>
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
                  {managerData.currentPlayers
                    .slice()
                    .sort((a,b) => {
                      const order: Record<string, number> = { GK: 0, DEF: 1, MID: 2, FWD: 3 }
                      const pc = order[a.elementType] - order[b.elementType]
                      if (pc !== 0) return pc
                      return (a.webName || a.secondName).localeCompare(b.webName || b.secondName)
                    })
                    .map(p => (
                      <tr key={p.id} className="border-t">
                        <td className="p-2">{p.webName || `${p.firstName} ${p.secondName}`} ({p.team.name})</td>
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
          </CardContent>
        </Card>

        {managerData.formerPlayers.length > 0 && (
          <Card>
            <CardHeader>
            <CardTitle>Former Players</CardTitle>
            <CardDescription>Players who no longer score points for {managerData.username}</CardDescription>
            </CardHeader>
            <CardContent>
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
                    {managerData.formerPlayers
                      .slice()
                      .sort((a,b) => {
                        const order: Record<string, number> = { GK: 0, DEF: 1, MID: 2, FWD: 3 }
                        const pc = order[a.elementType] - order[b.elementType]
                        if (pc !== 0) return pc
                        return (a.webName || a.secondName).localeCompare(b.webName || b.secondName)
                      })
                      .map(p => (
                        <tr key={p.id} className="border-t">
                          <td className="p-2">{p.webName || `${p.firstName} ${p.secondName}`} ({p.team.name})</td>
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
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
