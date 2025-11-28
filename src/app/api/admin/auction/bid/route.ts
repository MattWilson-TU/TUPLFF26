import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const adminBidSchema = z.object({
  lotId: z.string(),
  managerId: z.string(),
  amountHalfM: z.number(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.username || session.user.username !== 'Admin01') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { lotId, managerId, amountHalfM } = adminBidSchema.parse(body)

    // Get the lot and current highest bid
    const lot = await prisma.auctionLot.findUnique({
      where: { id: lotId },
      include: {
        player: true,
        bids: {
          include: {
            manager: {
              select: { id: true, username: true },
            },
          },
          orderBy: { amountHalfM: 'desc' },
        },
      },
    })

    if (!lot || lot.isSold) {
      return NextResponse.json(
        { error: 'Lot not found or already sold' },
        { status: 400 }
      )
    }

    // Check manager budget and squad limits
    const manager = await prisma.manager.findUnique({
      where: { id: managerId },
      include: {
        squads: {
          where: { phase: 1 }, // Only check current phase squad
          include: {
            players: {
              include: {
                player: {
                  select: { elementType: true }
                }
              }
            }
          }
        }
      }
    })

    if (!manager) {
      return NextResponse.json(
        { error: 'Manager not found' },
        { status: 400 }
      )
    }

    // Calculate manager's remaining budget (Budget - Spent) for validation
    // First get the current auction to find spent amounts
    const currentAuction = await prisma.auction.findFirst({
      where: { status: 'OPEN' },
      include: {
        lots: {
          where: {
            isSold: true,
            winnerId: managerId
          }
        }
      }
    })
    
    const totalSpentHalfM = currentAuction?.lots.reduce((sum, lot) => 
      sum + (lot.soldPriceHalfM || 0), 0
    ) || 0
    
    // Budget - Spent = Remaining
    const startingBudgetHalfM = Math.floor(manager.budgetKGBP / 500)
    const remainingBudgetHalfM = startingBudgetHalfM - totalSpentHalfM
    
    if (amountHalfM > remainingBudgetHalfM) {
      return NextResponse.json(
        { error: 'Insufficient budget' },
        { status: 400 }
      )
    }

    // Check squad size limit (max 11 players)
    const currentSquad = manager.squads[0]
    const currentSquadSize = currentSquad?.players.length || 0
    if (currentSquadSize >= 11) {
      return NextResponse.json(
        { error: 'Squad is full (maximum 11 players)' },
        { status: 400 }
      )
    }

    // Check position limits
    const positionLimits = { GK: 1, DEF: 4, MID: 5, FWD: 3 }
    const currentPositionCounts = { GK: 0, DEF: 0, MID: 0, FWD: 0 }
    
    if (currentSquad) {
      for (const squadPlayer of currentSquad.players) {
        const position = squadPlayer.player.elementType
        currentPositionCounts[position]++
      }
    }

    const playerPosition = lot.player.elementType
    if (currentPositionCounts[playerPosition] >= positionLimits[playerPosition]) {
      const positionNames = { GK: 'Goalkeeper', DEF: 'Defender', MID: 'Midfielder', FWD: 'Forward' }
      return NextResponse.json(
        { 
          error: `Maximum ${positionLimits[playerPosition]} ${positionNames[playerPosition]}${positionLimits[playerPosition] > 1 ? 's' : ''} allowed (you have ${currentPositionCounts[playerPosition]})` 
        },
        { status: 400 }
      )
    }

    // Create the bid
    const bid = await prisma.bid.create({
      data: {
        lotId,
        managerId,
        amountHalfM,
      },
      include: {
        manager: {
          select: { id: true, username: true },
        },
      },
    })

    return NextResponse.json(bid)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error placing admin bid:', error)
    return NextResponse.json(
      { error: 'Failed to place bid' },
      { status: 500 }
    )
  }
}
