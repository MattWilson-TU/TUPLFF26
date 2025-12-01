import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { fetchFinishedOrCurrentEventIds } from '@/lib/fpl'

export async function GET() {
  try {
    const managers = await prisma.manager.findMany({
      where: { username: { not: 'Admin01' } },
      include: {
        squads: {
          include: {
            players: {
              include: {
                player: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    // Map gameweeks to phases for summing by phase
    const gameweeks = await prisma.gameweek.findMany({ select: { id: true, phase: true } })
    const phaseToGameweeks: Record<number, number[]> = {}
    const allGameweekIds: number[] = []
    for (const gw of gameweeks) {
      phaseToGameweeks[gw.phase] = phaseToGameweeks[gw.phase] || []
      phaseToGameweeks[gw.phase].push(gw.id)
      allGameweekIds.push(gw.id)
    }

    // Determine most recent gameweek that has points data
    let recentGwId: number | null = null
    
    try {
      // First try to get finished/current from FPL API
      const finishedOrCurrent = await fetchFinishedOrCurrentEventIds()
      recentGwId = finishedOrCurrent.length > 0 ? finishedOrCurrent[finishedOrCurrent.length - 1] : null
    } catch (error) {
      console.warn('Failed to fetch FPL data, finding gameweek with data:', error)
    }
    
    // If we don't have FPL data or want to ensure we have data, find the most recent gameweek with points
    if (recentGwId === null) {
      const gameweekWithData = await prisma.gameweekPlayerPoints.groupBy({
        by: ['gameweekId'],
        _count: { points: true },
        orderBy: { gameweekId: 'desc' },
        take: 1
      })
      recentGwId = gameweekWithData.length > 0 ? gameweekWithData[0].gameweekId : null
    }

    // Ensure we only consider gameweeks that have actually happened for the baseline calculation
    // Filter allGameweekIds to those <= recentGwId (if known) or filter by checking for data presence
    let activeGameweekIds = allGameweekIds
    if (recentGwId !== null) {
      activeGameweekIds = allGameweekIds.filter(id => id <= (recentGwId as number))
    } else {
      // Fallback: find all gameweeks with ANY points data
      const gwsWithData = await prisma.gameweekPlayerPoints.groupBy({
        by: ['gameweekId'],
        _count: { points: true },
      })
      activeGameweekIds = gwsWithData.map(g => g.gameweekId)
    }

    // Compute total points and recent GW points per manager across all phases
    const enriched = [] as Array<any>
    for (const m of managers) {
      let totalPoints = 0
      let recentGwPoints = 0

      for (const squad of m.squads) {
        const gwIds = phaseToGameweeks[squad.phase] || []
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
          totalPoints += gwPoints.reduce((sum, g) => sum + (g.points || 0), 0)

          if (recentGwId != null && gwIds.includes(recentGwId)) {
            const recentPoints = await prisma.gameweekPlayerPoints.findMany({
              where: {
                gameweekId: { in: [recentGwId] },
                playerId: { in: squad.players.map((p) => p.playerId) },
              },
              select: { points: true }
            })
            recentGwPoints += recentPoints.reduce((sum, g) => sum + (g.points || 0), 0)
          }
        }
        // If no gameweek data, points remain 0
      }

      // Calculate Wheeler Dealer (WD) Score
      // Baseline: Points if manager kept Phase 1 squad for ALL active gameweeks
      let phase1TotalPoints = 0
      const phase1Squad = m.squads.find(s => s.phase === 1)
      
      if (phase1Squad && phase1Squad.players.length > 0 && activeGameweekIds.length > 0) {
        const p1PlayerIds = phase1Squad.players.map(p => p.playerId)
        
        // Calculate points Phase 1 players scored across ALL ACTIVE gameweeks
        const p1Points = await prisma.gameweekPlayerPoints.aggregate({
          where: {
            playerId: { in: p1PlayerIds },
            gameweekId: { in: activeGameweekIds }
          },
          _sum: { points: true }
        })
        phase1TotalPoints = p1Points._sum.points || 0
      }
      
      const wd = totalPoints - phase1TotalPoints

      enriched.push({
        ...m,
        computedTotalPoints: totalPoints,
        recentGwPoints,
        recentGwId,
        wd,
      })
    }

    return NextResponse.json(enriched)
  } catch (error) {
    console.error('Error fetching managers:', error)
    return NextResponse.json(
      { error: 'Failed to fetch managers' },
      { status: 500 }
    )
  }
}
