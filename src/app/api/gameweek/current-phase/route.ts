import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { fetchFinishedOrCurrentEventIds } from '@/lib/fpl'
import { gameweekToPhase } from '@/lib/scoring'

export async function GET() {
  try {
    // Determine most recent gameweek
    let recentGwId: number | null = null
    
    try {
      // First try to get finished/current from FPL API
      const finishedOrCurrent = await fetchFinishedOrCurrentEventIds()
      recentGwId = finishedOrCurrent.length > 0 ? finishedOrCurrent[finishedOrCurrent.length - 1] : null
    } catch (error) {
      console.warn('Failed to fetch FPL data, finding gameweek with data:', error)
    }
    
    // If we don't have FPL data, find the most recent gameweek with points
    if (recentGwId === null) {
      const gameweekWithData = await prisma.gameweekPlayerPoints.groupBy({
        by: ['gameweekId'],
        _count: { points: true },
        orderBy: { gameweekId: 'desc' },
        take: 1
      })
      recentGwId = gameweekWithData.length > 0 ? gameweekWithData[0].gameweekId : null
    }

    // If still no gameweek found, try to get the highest gameweek ID from the database
    if (recentGwId === null) {
      const latestGameweek = await prisma.gameweek.findFirst({
        orderBy: { id: 'desc' }
      })
      recentGwId = latestGameweek?.id || null
    }

    // Calculate phase from gameweek
    const phase = recentGwId ? gameweekToPhase(recentGwId) : 1

    return NextResponse.json({ phase, gameweekId: recentGwId })
  } catch (error) {
    console.error('current-phase error', error)
    return NextResponse.json({ error: 'Failed to get current phase' }, { status: 500 })
  }
}

