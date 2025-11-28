import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // Get top 5 players for each position
    const positions = ['GK', 'DEF', 'MID', 'FWD'] as const
    const topPlayers: Record<string, any[]> = { GK: [], DEF: [], MID: [], FWD: [] }

    for (const position of positions) {
      const players = await prisma.player.findMany({
        where: { elementType: position },
        include: {
          team: {
            select: { name: true }
          },
          currentOwner: {
            select: { username: true }
          }
        }
      })

      // Calculate total points dynamically for each player
      const playersWithPoints = await Promise.all(
        players.map(async (player) => {
          const totalPoints = await prisma.gameweekPlayerPoints.aggregate({
            where: { playerId: player.id },
            _sum: { points: true },
          })
          
          return {
            ...player,
            totalPoints: totalPoints._sum.points || 0,
          }
        })
      )

      // Sort by total points and take top 5
      topPlayers[position] = playersWithPoints
        .sort((a, b) => b.totalPoints - a.totalPoints)
        .slice(0, 5)
    }

    return NextResponse.json(topPlayers)
  } catch (error) {
    console.error('Error fetching top players:', error)
    return NextResponse.json(
      { error: 'Failed to fetch top players' },
      { status: 500 }
    )
  }
}
