import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isFixtureLocked, hasResult } from '@/lib/wc2026-scoring'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const fixtureId = String(body.fixtureId ?? '')
    const homeScore = Number(body.homeScore)
    const awayScore = Number(body.awayScore)

    if (!fixtureId) {
      return NextResponse.json({ error: 'fixtureId is required' }, { status: 400 })
    }
    if (!Number.isInteger(homeScore) || !Number.isInteger(awayScore)) {
      return NextResponse.json({ error: 'Scores must be whole numbers' }, { status: 400 })
    }
    if (homeScore < 0 || awayScore < 0 || homeScore > 20 || awayScore > 20) {
      return NextResponse.json({ error: 'Scores must be between 0 and 20' }, { status: 400 })
    }

    const fixture = await prisma.wcFixture.findUnique({ where: { id: fixtureId } })
    if (!fixture) {
      return NextResponse.json({ error: 'Fixture not found' }, { status: 404 })
    }
    if (isFixtureLocked(fixture.kickoffUtc)) {
      return NextResponse.json({ error: 'Predictions are locked after kickoff' }, { status: 400 })
    }
    if (hasResult(fixture.homeScore90, fixture.awayScore90)) {
      return NextResponse.json({ error: 'Fixture already has a result' }, { status: 400 })
    }

    const prediction = await prisma.wcPrediction.upsert({
      where: {
        managerId_fixtureId: {
          managerId: session.user.id,
          fixtureId,
        },
      },
      update: { homeScore, awayScore },
      create: {
        managerId: session.user.id,
        fixtureId,
        homeScore,
        awayScore,
      },
    })

    return NextResponse.json({
      id: prediction.id,
      fixtureId: prediction.fixtureId,
      homeScore: prediction.homeScore,
      awayScore: prediction.awayScore,
    })
  } catch (error) {
    console.error('Error saving WC2026 prediction:', error)
    return NextResponse.json({ error: 'Failed to save prediction' }, { status: 500 })
  }
}
