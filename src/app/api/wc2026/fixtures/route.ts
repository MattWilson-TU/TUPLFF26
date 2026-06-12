import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  computeFixturePoints,
  formatKickoffBst,
  formatStageLabel,
  hasResult,
  isFixtureInProgress,
  isFixtureLocked,
} from '@/lib/wc2026-scoring'
import { isWc2026Participant, wc2026ParticipantWhere } from '@/lib/wc2026-participants'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const manager = await prisma.manager.findUnique({
      where: { id: session.user.id },
      select: { wc2026Enabled: true, username: true },
    })
    if (!manager || !isWc2026Participant(manager)) {
      return NextResponse.json({ error: 'You are not enrolled in the WC2026 predictor' }, { status: 403 })
    }

    const fixtures = await prisma.wcFixture.findMany({
      orderBy: { kickoffUtc: 'asc' },
    })

    const predictions = await prisma.wcPrediction.findMany({
      where: { managerId: session.user.id },
    })
    const predictionByFixture = new Map(predictions.map((p) => [p.fixtureId, p]))

    const now = new Date()
    const result = fixtures.map((f) => {
      const prediction = predictionByFixture.get(f.id)
      const locked = isFixtureLocked(f.kickoffUtc, now)
      const finished = hasResult(f.homeScore90, f.awayScore90)
      const inProgress = isFixtureInProgress(f, now)
      const points = computeFixturePoints(prediction, f, now)
      const missed = locked && !prediction

      return {
        id: f.id,
        homeTeam: f.homeTeam,
        awayTeam: f.awayTeam,
        homeCrest: f.homeCrest,
        awayCrest: f.awayCrest,
        kickoffUtc: f.kickoffUtc.toISOString(),
        kickoffBst: formatKickoffBst(f.kickoffUtc),
        stageLabel: formatStageLabel(f.stage, f.groupName),
        status: f.status,
        locked,
        inProgress,
        finished,
        homeScore90: f.homeScore90,
        awayScore90: f.awayScore90,
        prediction: prediction
          ? { homeScore: prediction.homeScore, awayScore: prediction.awayScore }
          : null,
        missed,
        points,
      }
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching WC2026 fixtures:', error)
    return NextResponse.json({ error: 'Failed to fetch fixtures' }, { status: 500 })
  }
}
