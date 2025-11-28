import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const minPrice = searchParams.get('minPrice')
    const maxPrice = searchParams.get('maxPrice')
    const minPoints = searchParams.get('minPoints')
    const maxPoints = searchParams.get('maxPoints')
    const owner = searchParams.get('owner')

    const where: any = {}
    if (minPrice) where.nowCostHalfM = { ...(where.nowCostHalfM || {}), gte: Math.floor(Number(minPrice) * 2) }
    if (maxPrice) where.nowCostHalfM = { ...(where.nowCostHalfM || {}), lte: Math.floor(Number(maxPrice) * 2) }
    // Note: minPoints and maxPoints filtering will be done after calculating totalPoints
    if (owner === 'owned') where.currentOwnerId = { not: null }
    if (owner === 'unowned') where.currentOwnerId = null

    const players = await prisma.player.findMany({
      where,
      include: {
        team: true,
        currentOwner: {
          select: { id: true, username: true },
        },
        auctionLots: {
          where: { isSold: true },
          select: {
            soldPriceHalfM: true,
            winner: {
              select: { id: true, username: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    })

    // Calculate total points dynamically from gameweekPlayerPoints
    const playersWithCalculatedPoints = await Promise.all(
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

    // Apply points filtering after calculating totalPoints
    let filteredPlayers = playersWithCalculatedPoints
    if (minPoints) {
      filteredPlayers = filteredPlayers.filter(p => p.totalPoints >= Number(minPoints))
    }
    if (maxPoints) {
      filteredPlayers = filteredPlayers.filter(p => p.totalPoints <= Number(maxPoints))
    }

    // Sort by calculated total points
    filteredPlayers.sort((a, b) => b.totalPoints - a.totalPoints)

    return NextResponse.json(filteredPlayers)
  } catch (error) {
    console.error('Error fetching players:', error)
    return NextResponse.json(
      { error: 'Failed to fetch players' },
      { status: 500 }
    )
  }
}
