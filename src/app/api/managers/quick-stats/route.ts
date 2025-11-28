import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { fetchFinishedOrCurrentEventIds } from '@/lib/fpl'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Build phase -> gwIds map
    const gameweeks = await prisma.gameweek.findMany({ orderBy: { id: 'asc' } })
    const phaseToGwIds: Record<number, number[]> = {}
    for (const gw of gameweeks) {
      phaseToGwIds[gw.phase] = phaseToGwIds[gw.phase] || []
      phaseToGwIds[gw.phase].push(gw.id)
    }

    // Compute total points across all phases for all managers for standings
    const managers = await prisma.manager.findMany({
      where: { username: { not: 'Admin01' } },
      include: {
        squads: {
          include: { players: { select: { playerId: true } } },
        },
      },
    })

    async function computeManagerTotalPoints(managerId: string) {
      const m = managers.find(mm => mm.id === managerId)
      if (!m) return 0
      let total = 0
      for (const squad of m.squads) {
        const gwIds = phaseToGwIds[squad.phase] || []
        if (gwIds.length === 0 || squad.players.length === 0) continue
        
        // Check if we have any gameweek points data
        const hasGameweekData = await prisma.gameweekPlayerPoints.count({
          where: {
            gameweekId: { in: gwIds },
            playerId: { in: squad.players.map((p) => p.playerId) },
          }
        }) > 0

        if (hasGameweekData) {
          const gwPoints = await prisma.gameweekPlayerPoints.findMany({
            where: {
              gameweekId: { in: gwIds },
              playerId: { in: squad.players.map((p) => p.playerId) },
            },
            select: { points: true }
          })
          total += gwPoints.reduce((sum, g) => sum + (g.points || 0), 0)
        }
        // If no gameweek data, points remain 0
      }
      return total
    }

    // Compute totals for standings
    const totalsByManager: Record<string, number> = {}
    for (const m of managers) {
      totalsByManager[m.id] = await computeManagerTotalPoints(m.id)
    }

    const sorted = managers
      .map(m => ({ id: m.id, totalPoints: totalsByManager[m.id] || 0 }))
      .sort((a, b) => b.totalPoints - a.totalPoints)

    const position = sorted.findIndex(s => s.id === session.user.id) + 1 || null
    const totalPoints = totalsByManager[session.user.id] || 0

    // Last 3 gameweeks: find the last 3 gameweeks that actually have points data
    let last3Ids: number[] = []
    
    try {
      // First try to get finished/current from FPL API
      const finishedOrCurrentIds = await fetchFinishedOrCurrentEventIds()
      last3Ids = finishedOrCurrentIds.slice(-3) // already sorted ascending by helper
    } catch (error) {
      console.warn('Failed to fetch FPL data, finding gameweeks with data:', error)
    }
    
    // If we don't have FPL data or want to ensure we have data, find gameweeks with actual points
    if (last3Ids.length === 0) {
      const gameweeksWithData = await prisma.gameweekPlayerPoints.groupBy({
        by: ['gameweekId'],
        _count: { points: true },
        orderBy: { gameweekId: 'desc' },
        take: 3
      })
      last3Ids = gameweeksWithData.map(gw => gw.gameweekId).reverse() // reverse to get ascending order
    }

    // Use Phase 1 squad players as the base team for quick stats
    const phase1Squad = await prisma.squad.findFirst({
      where: { managerId: session.user.id, phase: 1 },
      include: { players: { select: { playerId: true } } },
    })

    let last3ByGw: Array<{ gameweekId: number; points: number }> = []
    if (phase1Squad && last3Ids.length > 0 && phase1Squad.players.length > 0) {
      // Check if we have any gameweek points data
      const hasGameweekData = await prisma.gameweekPlayerPoints.count({
        where: {
          gameweekId: { in: last3Ids },
          playerId: { in: phase1Squad.players.map((p) => p.playerId) },
        }
      }) > 0

      if (hasGameweekData) {
        const gwPoints = await prisma.gameweekPlayerPoints.groupBy({
          by: ['gameweekId'],
          where: {
            gameweekId: { in: last3Ids },
            playerId: { in: phase1Squad.players.map((p) => p.playerId) },
          },
          _sum: { points: true },
        })
        // Ensure ascending order oldest -> newest
        last3ByGw = last3Ids.map(gwId => ({
          gameweekId: gwId,
          points: gwPoints.find(g => g.gameweekId === gwId)?._sum.points || 0,
        }))
      } else {
        // No gameweek data, return zeros
        last3ByGw = last3Ids.map(gwId => ({
          gameweekId: gwId,
          points: 0,
        }))
      }
    }

    return NextResponse.json({ position, totalPoints, last3ByGw })
  } catch (error) {
    console.error('quick-stats error', error)
    return NextResponse.json({ error: 'Failed to compute quick stats' }, { status: 500 })
  }
}





