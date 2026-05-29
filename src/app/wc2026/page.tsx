'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Standing {
  id: string
  name: string
  username: string
  totalPoints: number
  predictionsMade: number
}

interface Fixture {
  id: string
  homeTeam: string
  awayTeam: string
  homeCrest: string | null
  awayCrest: string | null
  kickoffBst: string
  stageLabel: string
  status: string
  locked: boolean
  finished: boolean
  homeScore90: number | null
  awayScore90: number | null
  prediction: { homeScore: number; awayScore: number } | null
  points: number | null
}

export default function Wc2026Page() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [standings, setStandings] = useState<Standing[]>([])
  const [fixtures, setFixtures] = useState<Fixture[]>([])
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [draftScores, setDraftScores] = useState<Record<string, { home: string; away: string }>>({})
  const [savingId, setSavingId] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
    }
  }, [status, router])

  const loadData = useCallback(async () => {
    try {
      const [standingsRes, fixturesRes, updatedRes] = await Promise.all([
        fetch('/api/wc2026/standings'),
        fetch('/api/wc2026/fixtures'),
        fetch('/api/wc2026/last-updated'),
      ])

      if (standingsRes.ok) setStandings(await standingsRes.json())
      if (updatedRes.ok) {
        const data = await updatedRes.json()
        setLastUpdated(data.lastUpdated)
      }
      if (fixturesRes.ok) {
        const data: Fixture[] = await fixturesRes.json()
        setFixtures(data)
        const drafts: Record<string, { home: string; away: string }> = {}
        for (const f of data) {
          drafts[f.id] = {
            home: f.prediction ? String(f.prediction.homeScore) : '',
            away: f.prediction ? String(f.prediction.awayScore) : '',
          }
        }
        setDraftScores(drafts)
      }
    } catch (error) {
      console.error('Error loading WC2026 data:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (session) loadData()
  }, [session, loadData])

  async function savePrediction(fixtureId: string) {
    const draft = draftScores[fixtureId]
    if (!draft) return

    const homeScore = parseInt(draft.home, 10)
    const awayScore = parseInt(draft.away, 10)
    if (Number.isNaN(homeScore) || Number.isNaN(awayScore)) {
      alert('Enter valid scores for both teams')
      return
    }

    setSavingId(fixtureId)
    try {
      const res = await fetch('/api/wc2026/predictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fixtureId, homeScore, awayScore }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to save prediction')
      }
      await loadData()
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to save prediction')
    } finally {
      setSavingId(null)
    }
  }

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Loading WC2026 predictor...</p>
        </div>
      </div>
    )
  }

  if (!session) return null

  const myStanding = standings.find((s) => s.username === session.user?.username)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">WC2026 Predictor</h1>
              <p className="text-gray-600 mt-2">
                Predict full-time scores for every World Cup match. Max 3 points per fixture.
              </p>
              {lastUpdated && (
                <p className="text-sm text-gray-500 mt-1">
                  Fixtures last updated: {new Date(lastUpdated).toLocaleString('en-GB', { timeZone: 'Europe/London' })} BST
                </p>
              )}
              {myStanding && (
                <p className="text-sm text-blue-700 mt-1">
                  Your score: {myStanding.totalPoints} pts ({myStanding.predictionsMade} predictions)
                </p>
              )}
            </div>
            <Button asChild variant="outline">
              <Link href="/dashboard">← Back to Dashboard</Link>
            </Button>
          </div>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>WC2026 Standings</CardTitle>
            <CardDescription>
              Separate ranking from the main league — 3 pts exact score, 1 pt correct outcome
            </CardDescription>
          </CardHeader>
          <CardContent>
            {standings.length === 0 ? (
              <p className="text-sm text-gray-600">No standings yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pos</TableHead>
                    <TableHead>Manager</TableHead>
                    <TableHead>Predictions</TableHead>
                    <TableHead>Points</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {standings.map((manager, index) => (
                    <TableRow key={manager.id}>
                      <TableCell className="font-medium">{index + 1}</TableCell>
                      <TableCell>{manager.username}</TableCell>
                      <TableCell>{manager.predictionsMade}</TableCell>
                      <TableCell>
                        <span className="text-lg font-bold text-blue-600">{manager.totalPoints}</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Fixtures</CardTitle>
            <CardDescription>
              Kickoff times shown in BST. Predictions lock at kickoff.
              <br />
              Result after 90 minutes
            </CardDescription>
          </CardHeader>
          <CardContent>
            {fixtures.length === 0 ? (
              <p className="text-sm text-gray-600">
                No fixtures loaded yet. Ask admin to run a WC2026 data sync.
              </p>
            ) : (
              <div className="space-y-4">
                {fixtures.map((fixture) => {
                  const draft = draftScores[fixture.id] ?? { home: '', away: '' }
                  const canEdit = !fixture.locked && !fixture.finished

                  return (
                    <div
                      key={fixture.id}
                      className="border rounded-lg p-4 bg-white flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline">{fixture.stageLabel}</Badge>
                          {fixture.finished ? (
                            <Badge variant="secondary">Finished</Badge>
                          ) : fixture.locked ? (
                            <Badge variant="destructive">Locked</Badge>
                          ) : (
                            <Badge>Open</Badge>
                          )}
                          {fixture.points !== null && (
                            <Badge className="bg-green-600">{fixture.points} pts</Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-500">{fixture.kickoffBst} BST</p>
                        <div className="flex items-center gap-3 mt-2">
                          {fixture.homeCrest && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={fixture.homeCrest} alt="" className="h-6 w-6 object-contain" />
                          )}
                          <span className="font-medium">{fixture.homeTeam}</span>
                          <span className="text-gray-400">vs</span>
                          <span className="font-medium">{fixture.awayTeam}</span>
                          {fixture.awayCrest && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={fixture.awayCrest} alt="" className="h-6 w-6 object-contain" />
                          )}
                        </div>
                        {fixture.finished && fixture.homeScore90 !== null && fixture.awayScore90 !== null && (
                          <p className="text-sm text-gray-700 mt-1">
                            Result (90 min): {fixture.homeTeam} {fixture.homeScore90} – {fixture.awayScore90} {fixture.awayTeam}
                          </p>
                        )}
                        {fixture.prediction && (
                          <p className="text-sm text-gray-600 mt-1">
                            Your prediction: {fixture.homeTeam} {fixture.prediction.homeScore} – {fixture.prediction.awayScore} {fixture.awayTeam}
                          </p>
                        )}
                      </div>

                      {canEdit ? (
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min={0}
                            max={20}
                            className="w-16 text-center"
                            placeholder="H"
                            value={draft.home}
                            onChange={(e) =>
                              setDraftScores((prev) => ({
                                ...prev,
                                [fixture.id]: { ...draft, home: e.target.value },
                              }))
                            }
                          />
                          <span className="text-gray-400">–</span>
                          <Input
                            type="number"
                            min={0}
                            max={20}
                            className="w-16 text-center"
                            placeholder="A"
                            value={draft.away}
                            onChange={(e) =>
                              setDraftScores((prev) => ({
                                ...prev,
                                [fixture.id]: { ...draft, away: e.target.value },
                              }))
                            }
                          />
                          <Button
                            size="sm"
                            onClick={() => savePrediction(fixture.id)}
                            disabled={savingId === fixture.id}
                          >
                            {savingId === fixture.id ? 'Saving...' : 'Save'}
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
