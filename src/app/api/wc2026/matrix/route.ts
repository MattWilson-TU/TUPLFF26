import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  computeFixturePoints,
  computeManagerExactScores,
  computeManagerPoints,
  formatKickoffBst,
  hasResult,
} from '@/lib/wc2026-scoring'
import { canAccessWc2026, wc2026ParticipantWhere } from '@/lib/wc2026-participants'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const viewer = await prisma.manager.findUnique({
      where: { id: session.user.id },
      select: { wc2026Enabled: true, username: true },
    })
    if (!viewer || !canAccessWc2026(viewer)) {
      return NextResponse.json({ error: 'You are not enrolled in the WC2026 predictor' }, { status: 403 })
    }

    const managers = await prisma.manager.findMany({
      where: wc2026ParticipantWhere,
      select: { id: true, username: true },
    })

    const fixtures = await prisma.wcFixture.findMany({
      orderBy: { kickoffUtc: 'asc' },
    })
    const finishedFixtures = fixtures.filter((f) => hasResult(f.homeScore90, f.awayScore90))

    const predictions = await prisma.wcPrediction.findMany()
    const predictionsByManager = new Map<string, typeof predictions>()
    for (const p of predictions) {
      const list = predictionsByManager.get(p.managerId) ?? []
      list.push(p)
      predictionsByManager.set(p.managerId, list)
    }

    const sortedManagers = managers
      .map((manager) => {
        const managerPredictions = predictionsByManager.get(manager.id) ?? []
        return {
          id: manager.id,
          username: manager.username,
          totalPoints: computeManagerPoints(managerPredictions, finishedFixtures),
          exactScores: computeManagerExactScores(managerPredictions, finishedFixtures),
        }
      })
      .sort((a, b) => b.totalPoints - a.totalPoints || b.exactScores - a.exactScores)

    const matrixFixtures = finishedFixtures.map((fixture) => ({
      id: fixture.id,
      homeTeam: fixture.homeTeam,
      awayTeam: fixture.awayTeam,
      homeCrest: fixture.homeCrest,
      awayCrest: fixture.awayCrest,
      homeScore90: fixture.homeScore90,
      awayScore90: fixture.awayScore90,
      kickoffBst: formatKickoffBst(fixture.kickoffUtc),
      kickoffUtc: fixture.kickoffUtc.toISOString(),
    }))

    const cells: Record<string, Record<string, number>> = {}
    for (const fixture of finishedFixtures) {
      cells[fixture.id] = {}
      for (const manager of sortedManagers) {
        const prediction = (predictionsByManager.get(manager.id) ?? []).find(
          (p) => p.fixtureId === fixture.id
        )
        cells[fixture.id][manager.id] = computeFixturePoints(prediction, fixture) ?? 0
      }
    }

    return NextResponse.json({
      managers: sortedManagers,
      fixtures: matrixFixtures,
      cells,
    })
  } catch (error) {
    console.error('Error fetching WC2026 matrix:', error)
    return NextResponse.json({ error: 'Failed to fetch matrix' }, { status: 500 })
  }
}
