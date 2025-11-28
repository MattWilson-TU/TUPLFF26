import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const allocationSchema = z.object({
  playerId: z.number(),
  webName: z.string(),
  elementType: z.string(),
  teamName: z.string(),
  feeHalfM: z.number().min(1)
})

const bulkAllocationSchema = z.object({
  managerId: z.string(),
  phase: z.number().min(1).max(4),
  allocations: z.array(allocationSchema)
})

export async function POST(request: NextRequest) {
  try {
    // Check admin authorization
    const session = await getServerSession(authOptions)
    if (!session?.user?.username || session.user.username !== 'Admin01') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { managerId, phase, allocations } = bulkAllocationSchema.parse(body)

    // Validate manager exists
    const manager = await prisma.manager.findUnique({
      where: { id: managerId },
      include: {
        squads: {
          where: { phase },
          include: { players: true }
        }
      }
    })

    if (!manager) {
      return NextResponse.json({ error: 'Manager not found' }, { status: 404 })
    }

    // Validate all players exist
    const playerIds = allocations.map(a => a.playerId)
    const players = await prisma.player.findMany({
      where: { id: { in: playerIds } },
      include: { team: true }
    })

    if (players.length !== playerIds.length) {
      return NextResponse.json({ 
        error: 'One or more players not found' 
      }, { status: 404 })
    }

    // Check if any players are already owned by someone else IN THE SAME PHASE
    // We look up SquadPlayer records for the requested phase where the player is owned by a different manager
    const conflictingOwnership = await prisma.squadPlayer.findMany({
      where: {
        playerId: { in: playerIds },
        squad: {
          phase: phase,
          managerId: { not: managerId }
        }
      },
      include: {
        player: true,
        squad: {
          include: { manager: true }
        }
      }
    })

    if (conflictingOwnership.length > 0) {
      return NextResponse.json({ 
        error: `Players already owned by other managers in Phase ${phase}: ${conflictingOwnership.map(so => `${so.player.webName || so.player.secondName} (${so.squad.manager.username})`).join(', ')}` 
      }, { status: 400 })
    }

    // Check squad size limits - only validate the new allocation size
    if (allocations.length > 11) {
      return NextResponse.json({ 
        error: `Cannot allocate more than 11 players. Requested: ${allocations.length}` 
      }, { status: 400 })
    }

    // Check position limits - only validate the new allocation
    const positionCounts = {
      GK: 0,
      DEF: 0,
      MID: 0,
      FWD: 0
    }

    // Count new allocations by position
    allocations.forEach(allocation => {
      positionCounts[allocation.elementType as keyof typeof positionCounts]++
    })

    // Check if any position limits would be exceeded
    const positionLimits = { GK: 1, DEF: 4, MID: 5, FWD: 3 }
    const exceededPositions = Object.entries(positionCounts).filter(
      ([position, count]) => count > positionLimits[position as keyof typeof positionLimits]
    )

    if (exceededPositions.length > 0) {
      return NextResponse.json({ 
        error: `Position limits exceeded: ${exceededPositions.map(([pos, count]) => `${pos}: ${count}/${positionLimits[pos as keyof typeof positionLimits]}`).join(', ')}` 
      }, { status: 400 })
    }

    // Note: We will overwrite any existing squad data for this phase

    // Calculate manager's remaining budget
    const currentAuction = await prisma.auction.findFirst({
      where: { status: 'OPEN' },
      include: {
        lots: {
          where: { winnerId: managerId, isSold: true }
        }
      }
    })

    const totalSpentHalfM = currentAuction?.lots.reduce(
      (sum, lot) => sum + (lot.soldPriceHalfM || 0), 
      0
    ) || 0

    const startingBudgetHalfM = Math.floor(manager.budgetKGBP / 500)
    const remainingBudgetHalfM = startingBudgetHalfM - totalSpentHalfM
    const totalRequiredHalfM = allocations.reduce((sum, a) => sum + a.feeHalfM, 0)

    if (totalRequiredHalfM > remainingBudgetHalfM) {
      return NextResponse.json({ 
        error: `Insufficient budget. Required: £${(totalRequiredHalfM * 0.5).toFixed(1)}m, Available: £${(remainingBudgetHalfM * 0.5).toFixed(1)}m` 
      }, { status: 400 })
    }

    // Perform the bulk allocation in a transaction
    await prisma.$transaction(async (tx) => {
      // Find or create squad for this phase
      let squad = await tx.squad.findFirst({
        where: { managerId, phase }
      })

      if (!squad) {
        squad = await tx.squad.create({
          data: { managerId, phase }
        })
      } else {
        // Clear existing squad players for this phase
        await tx.squadPlayer.deleteMany({
          where: { squadId: squad.id }
        })
      }

      // Clear ownership from players previously owned by this manager in this phase
      const existingSquadPlayers = await tx.squadPlayer.findMany({
        where: { squadId: squad.id },
        select: { playerId: true }
      })
      
      if (existingSquadPlayers.length > 0) {
        const existingPlayerIds = existingSquadPlayers.map(sp => sp.playerId)
        // Only clear ownership if they are currently owned by this manager
        // This prevents clearing ownership if they've already moved to another manager in a later phase (edge case)
        // But mainly, we want to clear them so they are free to be picked up if they aren't in the new allocation
        await tx.player.updateMany({
          where: { 
            id: { in: existingPlayerIds },
            currentOwnerId: managerId 
          },
          data: { currentOwnerId: null }
        })
      }

      // Add all new players to squad
      if (allocations.length > 0) {
        await tx.squadPlayer.createMany({
          data: allocations.map(allocation => ({
            squadId: squad.id,
            playerId: allocation.playerId,
            feeHalfM: allocation.feeHalfM
          }))
        })

        // Update player ownership for all new players
        // We only update currentOwnerId if this is the LATEST phase or there are no other phases
        // However, for simplicity in the current model, currentOwnerId reflects the "active" ownership.
        // If we want to support historical ownership, we should rely on SquadPlayer and only use currentOwnerId for the active game state.
        // Assuming phase 2 is the active phase, we update ownership.
        await tx.player.updateMany({
          where: { id: { in: playerIds } },
          data: { currentOwnerId: managerId }
        })
      }

      // Create auction lots for budget tracking
      const auction = await tx.auction.findFirst({
        where: { status: 'OPEN' }
      })

      if (auction) {
        // For Phase 1, we need to handle budget tracking differently
        // For now, we'll create auction lots for the new allocations
        if (allocations.length > 0) {
          await tx.auctionLot.createMany({
            data: allocations.map(allocation => ({
              auctionId: auction.id,
              playerId: allocation.playerId,
              isSold: true,
              soldPriceHalfM: allocation.feeHalfM,
              winnerId: managerId
            }))
          })
        }
      }
    })

    return NextResponse.json({ 
      success: true, 
      message: `Successfully allocated ${allocations.length} players to ${manager.username} for £${(totalRequiredHalfM * 0.5).toFixed(1)}m in phase ${phase}`,
      totalSpent: totalRequiredHalfM * 0.5,
      playersAllocated: allocations.length
    })

  } catch (error) {
    console.error('Error bulk allocating players:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Invalid input data', 
        details: error.errors 
      }, { status: 400 })
    }

    return NextResponse.json({ 
      error: 'Failed to allocate players' 
    }, { status: 500 })
  }
}
