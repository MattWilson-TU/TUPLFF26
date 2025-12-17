import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // Prefer the most recently completed gameweek as the \"data last updated\" marker
    const latestCompleted = await prisma.gameweek.findFirst({
      where: { completedAt: { not: null } },
      orderBy: { completedAt: 'desc' }
    })

    let lastUpdated: Date | null = latestCompleted?.completedAt ?? null

    // Fallback: if no completedAt yet, use the most recent startedAt
    if (!lastUpdated) {
      const latestStarted = await prisma.gameweek.findFirst({
        where: { startedAt: { not: null } },
        orderBy: { startedAt: 'desc' }
      })
      lastUpdated = latestStarted?.startedAt ?? null
    }

    // Final fallback: if there are no timestamps at all, return null
    return NextResponse.json({
      lastUpdated: lastUpdated ? lastUpdated.toISOString() : null
    })
  } catch (error) {
    console.error('Error fetching data last updated timestamp:', error)
    return NextResponse.json(
      { lastUpdated: null, error: 'Failed to fetch data last updated timestamp' },
      { status: 500 }
    )
  }
}


