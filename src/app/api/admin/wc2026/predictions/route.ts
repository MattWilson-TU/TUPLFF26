import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isFixtureLocked } from '@/lib/wc2026-scoring'
import { isWc2026Admin, isWc2026Participant } from '@/lib/wc2026-participants'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.username || !isWc2026Admin(session.user.username)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const managerId = String(body.managerId ?? '')
    const fixtureId = String(body.fixtureId ?? '')
    const homeScore = Number(body.homeScore)
    const awayScore = Number(body.awayScore)

    if (!managerId || !fixtureId) {
      return NextResponse.json({ error: 'managerId and fixtureId are required' }, { status: 400 })
    }
    if (!Number.isInteger(homeScore) || !Number.isInteger(awayScore)) {
      return NextResponse.json({ error: 'Scores must be whole numbers' }, { status: 400 })
    }
    if (homeScore < 0 || awayScore < 0 || homeScore > 20 || awayScore > 20) {
      return NextResponse.json({ error: 'Scores must be between 0 and 20' }, { status: 400 })
    }

    const manager = await prisma.manager.findUnique({
      where: { id: managerId },
      select: { wc2026Enabled: true, username: true },
    })
    if (!manager || !isWc2026Participant(manager)) {
      return NextResponse.json({ error: 'Manager is not enrolled in the WC2026 predictor' }, { status: 404 })
    }

    const fixture = await prisma.wcFixture.findUnique({ where: { id: fixtureId } })
    if (!fixture) {
      return NextResponse.json({ error: 'Fixture not found' }, { status: 404 })
    }
    if (!isFixtureLocked(fixture.kickoffUtc)) {
      return NextResponse.json(
        { error: 'Predictions can only be entered after kickoff for managers who missed the deadline' },
        { status: 400 }
      )
    }

    const existing = await prisma.wcPrediction.findUnique({
      where: {
        managerId_fixtureId: { managerId, fixtureId },
      },
    })

    if (existing && existing.createdAt <= fixture.kickoffUtc) {
      return NextResponse.json(
        { error: 'Manager already submitted a prediction before the deadline' },
        { status: 400 }
      )
    }

    const prediction = await prisma.wcPrediction.upsert({
      where: {
        managerId_fixtureId: { managerId, fixtureId },
      },
      update: { homeScore, awayScore },
      create: {
        managerId,
        fixtureId,
        homeScore,
        awayScore,
      },
    })

    return NextResponse.json({
      id: prediction.id,
      managerId: prediction.managerId,
      fixtureId: prediction.fixtureId,
      homeScore: prediction.homeScore,
      awayScore: prediction.awayScore,
    })
  } catch (error) {
    console.error('Error saving admin WC2026 prediction:', error)
    return NextResponse.json({ error: 'Failed to save prediction' }, { status: 500 })
  }
}
