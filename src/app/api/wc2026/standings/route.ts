import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { scorePrediction, hasResult } from '@/lib/wc2026-scoring'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const managers = await prisma.manager.findMany({
      where: { username: { not: 'Admin01' } },
      select: { id: true, name: true, username: true },
    })

    const fixtures = await prisma.wcFixture.findMany()
    const finishedFixtures = fixtures.filter((f) => hasResult(f.homeScore90, f.awayScore90))

    const predictions = await prisma.wcPrediction.findMany()
    const predictionsByManager = new Map<string, typeof predictions>()
    for (const p of predictions) {
      const list = predictionsByManager.get(p.managerId) ?? []
      list.push(p)
      predictionsByManager.set(p.managerId, list)
    }

    const standings = managers
      .map((manager) => {
        const managerPredictions = predictionsByManager.get(manager.id) ?? []
        let totalPoints = 0

        for (const pred of managerPredictions) {
          const fixture = finishedFixtures.find((f) => f.id === pred.fixtureId)
          if (!fixture || fixture.homeScore90 === null || fixture.awayScore90 === null) continue
          totalPoints += scorePrediction(
            { home: pred.homeScore, away: pred.awayScore },
            { home: fixture.homeScore90, away: fixture.awayScore90 }
          )
        }

        return {
          id: manager.id,
          name: manager.name,
          username: manager.username,
          totalPoints,
          predictionsMade: managerPredictions.length,
        }
      })
      .sort((a, b) => b.totalPoints - a.totalPoints || b.predictionsMade - a.predictionsMade)

    return NextResponse.json(standings)
  } catch (error) {
    console.error('Error fetching WC2026 standings:', error)
    return NextResponse.json({ error: 'Failed to fetch standings' }, { status: 500 })
  }
}
