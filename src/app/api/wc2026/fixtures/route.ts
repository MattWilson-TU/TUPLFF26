import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { scorePrediction, formatKickoffBst, formatStageLabel, isFixtureLocked, hasResult } from '@/lib/wc2026-scoring'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
      let points: number | null = null

      if (prediction && finished && f.homeScore90 !== null && f.awayScore90 !== null) {
        points = scorePrediction(
          { home: prediction.homeScore, away: prediction.awayScore },
          { home: f.homeScore90, away: f.awayScore90 }
        )
      }

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
        finished,
        homeScore90: f.homeScore90,
        awayScore90: f.awayScore90,
        prediction: prediction
          ? { homeScore: prediction.homeScore, awayScore: prediction.awayScore }
          : null,
        points,
      }
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching WC2026 fixtures:', error)
    return NextResponse.json({ error: 'Failed to fetch fixtures' }, { status: 500 })
  }
}
