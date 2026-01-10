import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { fetchFinishedOrCurrentEventIds } from '@/lib/fpl'

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
    // Note: owner filtering is done AFTER correcting ownership based on current phase squads (see below)

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

    // Determine current active phase to check if players are in current phase squads
    let currentPhase = 1
    try {
      const finishedOrCurrent = await fetchFinishedOrCurrentEventIds()
      currentPhase = finishedOrCurrent.length > 0 ? 
        (finishedOrCurrent[finishedOrCurrent.length - 1] <= 11 ? 1 : 
         finishedOrCurrent[finishedOrCurrent.length - 1] <= 26 ? 2 :
         finishedOrCurrent[finishedOrCurrent.length - 1] <= 31 ? 3 : 4) : 1
    } catch (error) {
      console.warn('Failed to fetch FPL data for current phase, using fallback:', error)
      currentPhase = 1
    }

    // Get all players in current phase squads
    const currentPhaseSquadPlayers = await prisma.squadPlayer.findMany({
      where: {
        squad: {
          phase: currentPhase
        }
      },
      select: {
        playerId: true
      }
    })
    const playerIdsInCurrentPhaseSquads = new Set(currentPhaseSquadPlayers.map(sp => sp.playerId))

    // Override currentOwner to null for players not in any current phase squad
    const playersWithCorrectedOwnership = playersWithCalculatedPoints.map(player => {
      if (!playerIdsInCurrentPhaseSquads.has(player.id)) {
        return {
          ...player,
          currentOwner: null,
          currentOwnerId: null
        }
      }
      return player
    })

    // Apply points and owner filtering after calculating totalPoints and correcting ownership
    let filteredPlayers = playersWithCorrectedOwnership
    if (minPoints) {
      filteredPlayers = filteredPlayers.filter(p => p.totalPoints >= Number(minPoints))
    }
    if (maxPoints) {
      filteredPlayers = filteredPlayers.filter(p => p.totalPoints <= Number(maxPoints))
    }
    // Apply owner filter after correcting ownership based on current phase squads
    if (owner === 'owned') {
      filteredPlayers = filteredPlayers.filter(p => p.currentOwnerId !== null)
    } else if (owner === 'unowned') {
      filteredPlayers = filteredPlayers.filter(p => p.currentOwnerId === null)
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
