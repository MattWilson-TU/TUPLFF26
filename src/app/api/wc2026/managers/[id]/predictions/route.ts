import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  computeFixturePoints,
  computeManagerExactScores,
  computeManagerPoints,
  formatKickoffBst,
  formatStageLabel,
  hasResult,
} from '@/lib/wc2026-scoring'
import { canAccessWc2026, wc2026ParticipantWhere } from '@/lib/wc2026-participants'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params

    const manager = await prisma.manager.findFirst({
      where: { id, ...wc2026ParticipantWhere },
      select: { id: true, name: true, username: true },
    })
    if (!manager) {
      return NextResponse.json({ error: 'Manager not found' }, { status: 404 })
    }

    const fixtures = await prisma.wcFixture.findMany({
      orderBy: { kickoffUtc: 'asc' },
    })
    const finishedFixtures = fixtures.filter((f) => hasResult(f.homeScore90, f.awayScore90))

    const predictions = await prisma.wcPrediction.findMany({
      where: { managerId: manager.id },
    })
    const predictionByFixture = new Map(predictions.map((p) => [p.fixtureId, p]))

    const rows = finishedFixtures.map((fixture) => {
      const prediction = predictionByFixture.get(fixture.id)
      const points = computeFixturePoints(prediction, fixture) ?? 0

      return {
        fixtureId: fixture.id,
        homeTeam: fixture.homeTeam,
        awayTeam: fixture.awayTeam,
        homeCrest: fixture.homeCrest,
        awayCrest: fixture.awayCrest,
        kickoffBst: formatKickoffBst(fixture.kickoffUtc),
        stageLabel: formatStageLabel(fixture.stage, fixture.groupName),
        homeScore90: fixture.homeScore90,
        awayScore90: fixture.awayScore90,
        predictedScore: prediction
          ? `${prediction.homeScore}-${prediction.awayScore}`
          : null,
        missed: !prediction,
        points,
      }
    })

    const totalPoints = computeManagerPoints(predictions, finishedFixtures)
    const exactScores = computeManagerExactScores(predictions, finishedFixtures)

    return NextResponse.json({
      manager,
      totalPoints,
      exactScores,
      results: rows,
    })
  } catch (error) {
    console.error('Error fetching WC2026 manager predictions:', error)
    return NextResponse.json({ error: 'Failed to fetch manager predictions' }, { status: 500 })
  }
}
