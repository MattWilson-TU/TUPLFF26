'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface GroupStanding {
  team: string
  crest: string | null
  played: number
  pts: number
  gd: number
  position?: number
  tied?: boolean
}

interface GroupTable {
  group: string
  complete: boolean
  playedMatches: number
  totalMatches: number
  teams: GroupStanding[]
}

interface ThirdPlaceEntry {
  group: string
  team: string
  crest: string | null
  pts: number
  gd: number
  gf: number
  rank?: number
  qualified?: boolean
  tied?: boolean
}

interface BracketTeam {
  name: string
  crest: string | null
  slot: string
}

interface RoundOf32Match {
  matchNo: number
  home: BracketTeam
  away: BracketTeam
  provisional: boolean
}

interface KnockoutProjection {
  groupStageComplete: boolean
  provisional: boolean
  hasUnresolvedTies: boolean
  annexCOption: number | null
  groups: GroupTable[]
  thirdPlaceRanking: ThirdPlaceEntry[]
  roundOf32: RoundOf32Match[]
}

function TeamCell({ team, crest }: { team: string; crest: string | null }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      {crest && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={crest} alt="" className="h-5 w-5 object-contain shrink-0" />
      )}
      <span className="truncate">{team}</span>
    </div>
  )
}

function positionRowClass(position?: number): string {
  if (position === 1 || position === 2) return 'bg-green-50'
  if (position === 3) return 'bg-blue-50'
  return ''
}

export default function Wc2026KnockoutPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [projection, setProjection] = useState<KnockoutProjection | null>(null)
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
      const res = await fetch('/api/wc2026/knockout-projection')
      if (res.ok) setProjection(await res.json())
    } catch (error) {
      console.error('Error loading knockout projection:', error)
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
          <p className="mt-4 text-gray-600">Loading Round of 32 projection...</p>
        </div>
      </div>
    )
  }

  if (!session || !enrolled) return null

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="container mx-auto px-4 py-6 sm:py-8">
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Round of 32 Projection</h1>
              <p className="text-sm sm:text-base text-gray-600 mt-2">
                Group standings and knockout pairings from actual results (FIFA §12.6 &amp; Annex C).
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                {projection?.groupStageComplete ? (
                  <Badge className="bg-green-600">Final</Badge>
                ) : (
                  <Badge variant="secondary">Provisional</Badge>
                )}
                {projection?.annexCOption && (
                  <Badge variant="outline">Annex C option {projection.annexCOption}</Badge>
                )}
              </div>
              {projection?.hasUnresolvedTies && (
                <p className="text-xs sm:text-sm text-amber-700 mt-2">
                  Some positions are tied after points, GD and GF. Fair play / FIFA ranking not applied.
                </p>
              )}
            </div>
            <Button asChild variant="outline" className="w-full lg:w-auto">
              <Link href="/wc2026">← Back to Predictor</Link>
            </Button>
          </div>
        </div>

        {projection && (
          <>
            <Card className="mb-6">
              <CardHeader className="px-4 sm:px-6">
                <CardTitle>Group Standings</CardTitle>
                <CardDescription>P1 and P2 qualify directly; P3 enters the third-place ranking.</CardDescription>
              </CardHeader>
              <CardContent className="px-4 sm:px-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {projection.groups.map((group) => (
                    <div key={group.group} className="border rounded-lg overflow-hidden">
                      <div className="bg-gray-100 px-3 py-2 flex items-center justify-between">
                        <span className="font-semibold text-sm">Group {group.group}</span>
                        {!group.complete && (
                          <Badge variant="outline" className="text-xs">
                            {group.playedMatches}/{group.totalMatches}
                          </Badge>
                        )}
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-8">#</TableHead>
                            <TableHead>Team</TableHead>
                            <TableHead className="text-right w-10">P</TableHead>
                            <TableHead className="text-right w-10">GD</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {group.teams.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={4} className="text-center text-gray-500 text-sm">
                                No results yet
                              </TableCell>
                            </TableRow>
                          ) : (
                            group.teams.map((team) => (
                              <TableRow
                                key={team.team}
                                className={positionRowClass(team.position)}
                              >
                                <TableCell className="text-sm">
                                  {team.position}
                                  {team.tied ? '*' : ''}
                                </TableCell>
                                <TableCell className="text-sm py-2">
                                  <TeamCell team={team.team} crest={team.crest} />
                                </TableCell>
                                <TableCell className="text-right text-sm">{team.pts}</TableCell>
                                <TableCell className="text-right text-sm">
                                  {team.gd > 0 ? `+${team.gd}` : team.gd}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="mb-6">
              <CardHeader className="px-4 sm:px-6">
                <CardTitle>Third-Place Ranking</CardTitle>
                <CardDescription>Top 8 qualify for the Round of 32.</CardDescription>
              </CardHeader>
              <CardContent className="px-4 sm:px-6 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rank</TableHead>
                      <TableHead>Grp</TableHead>
                      <TableHead>Team</TableHead>
                      <TableHead className="text-right">Pts</TableHead>
                      <TableHead className="text-right">GD</TableHead>
                      <TableHead className="text-right">GF</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {projection.thirdPlaceRanking.map((entry) => (
                      <TableRow
                        key={entry.group}
                        className={entry.qualified ? 'bg-green-50' : 'text-gray-500'}
                      >
                        <TableCell>
                          {entry.rank != null ? `3-${entry.rank}` : '—'}
                          {entry.tied ? '*' : ''}
                        </TableCell>
                        <TableCell>{entry.group}</TableCell>
                        <TableCell>
                          <TeamCell team={entry.team} crest={entry.crest} />
                        </TableCell>
                        <TableCell className="text-right">{entry.pts}</TableCell>
                        <TableCell className="text-right">
                          {entry.gd > 0 ? `+${entry.gd}` : entry.gd}
                        </TableCell>
                        <TableCell className="text-right">{entry.gf}</TableCell>
                        <TableCell>
                          {entry.qualified ? (
                            <Badge className="bg-green-600">Qualified</Badge>
                          ) : (
                            <Badge variant="secondary">Out</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="px-4 sm:px-6">
                <CardTitle>Round of 32</CardTitle>
                <CardDescription>
                  Projected fixtures per §12.6
                  {projection.annexCOption ? ` (Annex C option ${projection.annexCOption})` : ''}.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-4 sm:px-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {projection.roundOf32.map((match) => (
                    <div key={match.matchNo} className="border rounded-lg p-4 bg-white">
                      <Badge variant="outline" className="mb-2">
                        M{match.matchNo}
                      </Badge>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <TeamCell team={match.home.name} crest={match.home.crest} />
                          <span className="text-xs text-gray-500 ml-7">{match.home.slot}</span>
                        </div>
                        <span className="text-gray-400 shrink-0">vs</span>
                        <div className="flex-1 min-w-0 text-right">
                          <TeamCell team={match.away.name} crest={match.away.crest} />
                          <span className="text-xs text-gray-500 block text-right">
                            {match.away.slot}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}
