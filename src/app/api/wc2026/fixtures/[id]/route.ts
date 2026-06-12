import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  computeFixturePoints,
  formatKickoffBst,
  formatStageLabel,
  hasResult,
  isFixtureLocked,
} from '@/lib/wc2026-scoring'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const fixture = await prisma.wcFixture.findUnique({ where: { id } })
    if (!fixture) {
      return NextResponse.json({ error: 'Fixture not found' }, { status: 404 })
    }

    const now = new Date()
    if (!isFixtureLocked(fixture.kickoffUtc, now)) {
      return NextResponse.json(
        { error: 'Predictions are hidden until kickoff' },
        { status: 403 }
      )
    }

    const finished = hasResult(fixture.homeScore90, fixture.awayScore90)

    const managers = await prisma.manager.findMany({
      where: { username: { not: 'Admin01' } },
      select: { id: true, name: true, username: true },
      orderBy: { username: 'asc' },
    })

    const predictions = await prisma.wcPrediction.findMany({
      where: { fixtureId: id },
    })
    const predictionByManager = new Map(predictions.map((p) => [p.managerId, p]))

    const rows = managers.map((manager) => {
      const prediction = predictionByManager.get(manager.id)
      const points = computeFixturePoints(prediction, fixture, now)

      return {
        id: manager.id,
        name: manager.name,
        username: manager.username,
        prediction: prediction
          ? { homeScore: prediction.homeScore, awayScore: prediction.awayScore }
          : null,
        missed: !prediction,
        points: finished ? (points ?? 0) : null,
      }
    })

    if (finished) {
      rows.sort(
        (a, b) =>
          (b.points ?? 0) - (a.points ?? 0) ||
          a.username.localeCompare(b.username)
      )
    }

    return NextResponse.json({
      fixture: {
        id: fixture.id,
        homeTeam: fixture.homeTeam,
        awayTeam: fixture.awayTeam,
        homeCrest: fixture.homeCrest,
        awayCrest: fixture.awayCrest,
        kickoffBst: formatKickoffBst(fixture.kickoffUtc),
        stageLabel: formatStageLabel(fixture.stage, fixture.groupName),
        status: fixture.status,
        finished,
        homeScore90: fixture.homeScore90,
        awayScore90: fixture.awayScore90,
      },
      managers: rows,
      showPoints: finished,
    })
  } catch (error) {
    console.error('Error fetching WC2026 fixture predictions:', error)
    return NextResponse.json({ error: 'Failed to fetch fixture predictions' }, { status: 500 })
  }
}
