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
import { WcFixtureLine } from '@/components/wc2026-fixture-line'
import { hasResult } from '@/lib/wc2026-scoring'

interface Standing {
  id: string
  name: string
  username: string
  totalPoints: number
  exactScores: number
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
  inProgress: boolean
  finished: boolean
  homeScore90: number | null
  awayScore90: number | null
  prediction: { homeScore: number; awayScore: number } | null
  missed: boolean
  points: number | null
}

function getFixturePanelClass(fixture: Fixture): string {
  const base =
    'border rounded-lg p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between'

  if (fixture.points === 3) return `${base} bg-green-100 border-green-200`
  if (fixture.points === 1) return `${base} bg-yellow-50 border-yellow-200`
  if (fixture.missed || fixture.points === 0) return `${base} bg-gray-100 border-gray-200`

  return `${base} bg-white`
}

function getPointsBadgeClass(points: number): string {
  if (points === 3) return 'bg-green-600'
  if (points === 1) return 'bg-yellow-400 text-yellow-950 hover:bg-yellow-400'
  return 'bg-gray-400 hover:bg-gray-400'
}

export default function Wc2026Page() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [standings, setStandings] = useState<Standing[]>([])
  const [fixtures, setFixtures] = useState<Fixture[]>([])
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [enrolled, setEnrolled] = useState(true)
  const [draftScores, setDraftScores] = useState<Record<string, { home: string; away: string }>>({})
  const [savingId, setSavingId] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
    }
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
  }, [router])

  useEffect(() => {
    if (session) loadData()
  }, [session, loadData])

  function scrollToNextFixture() {
    const next = fixtures.find((f) => !f.locked)
    if (!next) return
    document.getElementById(`fixture-${next.id}`)?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    })
  }

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

  if (!session || !enrolled) return null

  const myStanding = standings.find((s) => s.username === session.user?.username)
  const nextOpenFixture = fixtures.find((f) => !f.locked)

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="container mx-auto px-4 py-6 sm:py-8">
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">WC2026 Predictor</h1>
              <p className="text-sm sm:text-base text-gray-600 mt-2">
                Predict full-time scores for every World Cup match. Max 3 points per fixture.
              </p>
              {lastUpdated && (
                <p className="text-xs sm:text-sm text-gray-500 mt-1 break-words">
                  Fixtures last updated:{' '}
                  {new Date(lastUpdated).toLocaleString('en-GB', { timeZone: 'Europe/London' })} BST
                </p>
              )}
              {myStanding && (
                <p className="text-sm text-blue-700 mt-1">
                  Your score: {myStanding.totalPoints} pts
                  {myStanding.exactScores > 0 && ` (${myStanding.exactScores} exact)`}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2 w-full lg:w-auto lg:shrink-0">
              <Button asChild variant="outline" className="w-full lg:w-auto">
                <Link href="/wc2026/matrix">Points matrix →</Link>
              </Button>
              <Button asChild variant="outline" className="w-full lg:w-auto">
                <Link href="/wc2026/knockout">Round of 32 projection →</Link>
              </Button>
              {nextOpenFixture && (
                <Button
                  onClick={scrollToNextFixture}
                  className="w-full lg:w-auto h-auto py-2.5 whitespace-normal text-left sm:text-center"
                >
                  <span className="block font-semibold">Next fixture</span>
                  <span className="block text-sm font-normal opacity-90 mt-0.5">
                    {nextOpenFixture.homeTeam} vs {nextOpenFixture.awayTeam}
                  </span>
                </Button>
              )}
              <Button asChild variant="outline" className="w-full lg:w-auto">
                <Link href="/dashboard">← Back to Dashboard</Link>
              </Button>
            </div>
          </div>
        </div>

        <Card className="mb-6 sm:mb-8">
          <CardHeader className="px-4 sm:px-6">
            <CardTitle>WC2026 Standings</CardTitle>
            <CardDescription>
              Ranked by points, then exact scores (3 pts). 1 pt for correct outcome.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 sm:px-6">
            {standings.length === 0 ? (
              <p className="text-sm text-gray-600">No standings yet.</p>
            ) : (
              <div className="overflow-x-auto -mx-4 sm:-mx-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Pos</TableHead>
                      <TableHead>Manager</TableHead>
                      <TableHead className="text-right whitespace-nowrap">Exact</TableHead>
                      <TableHead className="text-right">Points</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {standings.map((manager, index) => (
                      <TableRow key={manager.id}>
                        <TableCell className="font-medium">{index + 1}</TableCell>
                        <TableCell className="max-w-[8rem] sm:max-w-none truncate">
                          <Link
                            href={`/wc2026/managers/${manager.id}`}
                            className="text-blue-600 hover:underline font-medium"
                          >
                            {manager.username}
                          </Link>
                        </TableCell>
                        <TableCell className="text-right">{manager.exactScores}</TableCell>
                        <TableCell className="text-right">
                          <span className="text-base sm:text-lg font-bold text-blue-600">{manager.totalPoints}</span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="px-4 sm:px-6">
            <CardTitle>Fixtures</CardTitle>
            <CardDescription>
              Kickoff times shown in BST. Predictions lock at kickoff.
              <br />
              Result after 90 minutes
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 sm:px-6">
            {fixtures.length === 0 ? (
              <p className="text-sm text-gray-600">
                No fixtures loaded yet. Ask admin to run a WC2026 data sync.
              </p>
            ) : (
              <div className="space-y-4">
                {fixtures.map((fixture) => {
                  const draft = draftScores[fixture.id] ?? { home: '', away: '' }
                  const canEdit = !fixture.locked && !fixture.finished
                  const resultKnown = hasResult(fixture.homeScore90, fixture.awayScore90)
                  const isClickable = fixture.locked

                  const panelContent = (
                    <>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <Badge variant="outline">{fixture.stageLabel}</Badge>
                          {fixture.finished ? (
                            <Badge variant="secondary">Finished</Badge>
                          ) : fixture.inProgress ? (
                            <Badge variant="destructive">In progress</Badge>
                          ) : fixture.locked ? (
                            <Badge variant="destructive">Locked</Badge>
                          ) : (
                            <Badge>Open</Badge>
                          )}
                          {fixture.points !== null && (
                            <Badge className={getPointsBadgeClass(fixture.points)}>
                              {fixture.points} pts
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-500">{fixture.kickoffBst} BST</p>
                        <div className="mt-2">
                          <WcFixtureLine
                            homeTeam={fixture.homeTeam}
                            awayTeam={fixture.awayTeam}
                            homeCrest={fixture.homeCrest}
                            awayCrest={fixture.awayCrest}
                            homeScore90={resultKnown ? fixture.homeScore90 : null}
                            awayScore90={resultKnown ? fixture.awayScore90 : null}
                          />
                        </div>
                        {resultKnown && (
                          <p className="text-xs text-gray-500 mt-1">Result after 90 minutes</p>
                        )}
                        {fixture.missed && (
                          <p className="text-sm text-gray-600 mt-1">No prediction entered — 0 pts</p>
                        )}
                        {fixture.prediction && (
                          <p className="text-sm text-gray-600 mt-1 break-words">
                            Your prediction: {fixture.prediction.homeScore} – {fixture.prediction.awayScore}
                          </p>
                        )}
                        {isClickable && (
                          <p className="text-sm text-blue-600 mt-2 hidden md:block">
                            {fixture.finished
                              ? 'View all predictions & points →'
                              : 'View all manager predictions →'}
                          </p>
                        )}
                      </div>

                      {canEdit ? (
                        <div className="flex items-center gap-2 w-full md:w-auto pt-3 md:pt-0 border-t md:border-t-0 border-gray-100">
                          <Input
                            type="number"
                            min={0}
                            max={20}
                            className="w-14 sm:w-16 text-center"
                            placeholder="H"
                            value={draft.home}
                            onChange={(e) =>
                              setDraftScores((prev) => ({
                                ...prev,
                                [fixture.id]: { ...draft, home: e.target.value },
                              }))
                            }
                          />
                          <span className="text-gray-400 shrink-0">–</span>
                          <Input
                            type="number"
                            min={0}
                            max={20}
                            className="w-14 sm:w-16 text-center"
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
                            className="ml-auto shrink-0"
                            onClick={() => savePrediction(fixture.id)}
                            disabled={savingId === fixture.id}
                          >
                            {savingId === fixture.id ? 'Saving...' : 'Save'}
                          </Button>
                        </div>
                      ) : null}
                    </>
                  )

                  const panelClass = getFixturePanelClass(fixture)
                  const fixtureHref = `/wc2026/fixtures/${fixture.id}`

                  if (isClickable) {
                    return (
                      <div id={`fixture-${fixture.id}`} key={fixture.id} className="scroll-mt-24">
                        <button
                          type="button"
                          onClick={() => router.push(fixtureHref)}
                          aria-label={
                            fixture.finished
                              ? `View all predictions and points for ${fixture.homeTeam} vs ${fixture.awayTeam}`
                              : `View all manager predictions for ${fixture.homeTeam} vs ${fixture.awayTeam}`
                          }
                          className={`${panelClass} md:hidden w-full text-left touch-manipulation active:opacity-90 transition-opacity`}
                        >
                          {panelContent}
                        </button>
                        <Link
                          href={fixtureHref}
                          className={`${panelClass} hidden md:flex no-underline text-inherit hover:shadow-md transition-shadow cursor-pointer`}
                        >
                          {panelContent}
                        </Link>
                      </div>
                    )
                  }

                  return (
                    <div id={`fixture-${fixture.id}`} key={fixture.id} className={`${panelClass} scroll-mt-24`}>
                      {panelContent}
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
