import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // Get all managers with their squads
    const managers = await prisma.manager.findMany({
      where: {
        username: { not: 'Admin01' } // Exclude admin
      },
      select: {
        id: true,
        username: true,
        name: true,
        squads: {
          include: {
            players: {
              select: { playerId: true }
            }
          }
        }
      }
    })

    // Build phase -> gameweek mapping
    const gameweeks = await prisma.gameweek.findMany({ orderBy: { id: 'asc' } })
    const phaseToGameweeks: Record<number, number[]> = {}
    for (const gw of gameweeks) {
      phaseToGameweeks[gw.phase] = phaseToGameweeks[gw.phase] || []
      phaseToGameweeks[gw.phase].push(gw.id)
    }

    // Process each manager to calculate their performance
    const managerStats = await Promise.all(managers.map(async (manager) => {
      let totalPoints = 0
      const gameweekPointsMap: Record<number, number> = {}

      // Calculate points for each phase
      for (const squad of manager.squads) {
        const gwIds = phaseToGameweeks[squad.phase] || []
        if (gwIds.length === 0 || squad.players.length === 0) continue

        // Check if we have any gameweek points data
        const hasGameweekData = await prisma.gameweekPlayerPoints.count({
          where: {
            gameweekId: { in: gwIds },
            playerId: { in: squad.players.map(p => p.playerId) }
          }
        }) > 0

        if (hasGameweekData) {
          // Get points for all players in this squad for all gameweeks in this phase
          const playerPoints = await prisma.gameweekPlayerPoints.findMany({
            where: {
              gameweekId: { in: gwIds },
              playerId: { in: squad.players.map(p => p.playerId) }
            },
            select: {
              gameweekId: true,
              points: true
            }
          })

          // Aggregate points by gameweek
          for (const pp of playerPoints) {
            gameweekPointsMap[pp.gameweekId] = (gameweekPointsMap[pp.gameweekId] || 0) + pp.points
          }
        }
        // If no gameweek data, points remain 0
      }

      // Calculate total points and build gameweek array
      const gameweekPoints: Array<{ gameweekId: number; points: number; cumulativePoints: number }> = []
      let cumulativePoints = 0

      // Only include gameweeks that have points or are needed for cumulative calculation
      const gameweeksWithPoints = gameweeks.filter(gw => gameweekPointsMap[gw.id] > 0)
      const latestGameweekWithPoints = gameweeksWithPoints.length > 0 
        ? Math.max(...gameweeksWithPoints.map(gw => gw.id))
        : 0

      for (const gw of gameweeks) {
        const points = gameweekPointsMap[gw.id] || 0
        cumulativePoints += points
        totalPoints += points

        // Only include gameweeks up to the latest one with points
        if (gw.id <= latestGameweekWithPoints) {
          gameweekPoints.push({
            gameweekId: gw.id,
            points,
            cumulativePoints
          })
        }
      }

      return {
        username: manager.username,
        name: manager.name,
        totalPoints,
        gameweekPoints
      }
    }))

    return NextResponse.json(managerStats)
  } catch (error) {
    console.error('Error fetching manager performance:', error)
    return NextResponse.json(
      { error: 'Failed to fetch manager performance' },
      { status: 500 }
    )
  }
}
