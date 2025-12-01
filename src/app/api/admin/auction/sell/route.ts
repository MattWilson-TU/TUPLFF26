import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const sellSchema = z.object({
  lotId: z.string(),
  managerId: z.string().nullable().optional(),
  priceHalfM: z.number().min(0),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.username || session.user.username !== 'Admin01') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    console.log('Sell request body:', body)
    const { lotId, managerId, priceHalfM } = sellSchema.parse(body)

    // Get the lot information with player details
    const lot = await prisma.auctionLot.findUnique({
      where: { id: lotId },
      include: {
        player: {
          select: { nowCostHalfM: true }
        }
      },
    })

    if (!lot) {
      return NextResponse.json(
        { error: 'Lot not found' },
        { status: 400 }
      )
    }

    console.log('Processing sale for lot:', lotId, 'managerId:', managerId, 'price:', priceHalfM)

    // Validate manual allocation if managerId and priceHalfM are provided
    if (managerId && priceHalfM > 0) {
      // Get manager's current budget and calculate spent amount
      const manager = await prisma.manager.findUnique({
        where: { id: managerId },
        select: { budgetKGBP: true, username: true }
      })

      if (!manager) {
        return NextResponse.json(
          { error: 'Manager not found' },
          { status: 400 }
        )
      }

      const startingPrice = lot.player.nowCostHalfM
      const startingBudgetHalfM = Math.floor(manager.budgetKGBP / 500) // This is the starting budget (£150m)

      // Calculate how much this manager has already spent in this auction
      const auction = await prisma.auction.findUnique({
        where: { id: lot.auctionId },
        include: {
          lots: {
            where: {
              isSold: true,
              winnerId: managerId
            }
          }
        }
      })

      const totalSpentHalfM = auction?.lots.reduce((sum, lot) => sum + (lot.soldPriceHalfM || 0), 0) || 0
      const remainingBudgetHalfM = startingBudgetHalfM - totalSpentHalfM

      // Validate price is not less than starting price
      if (priceHalfM < startingPrice) {
        return NextResponse.json(
          { 
            error: `Price must be at least the starting price of £${(startingPrice * 0.5).toFixed(1)}m`,
            startingPrice: startingPrice * 0.5
          },
          { status: 400 }
        )
      }

      // Validate price is not more than manager's remaining budget
      if (priceHalfM > remainingBudgetHalfM) {
        return NextResponse.json(
          { 
            error: `${manager.username} only has £${(remainingBudgetHalfM * 0.5).toFixed(1)}m remaining budget`,
            maxBudget: remainingBudgetHalfM * 0.5
          },
          { status: 400 }
        )
      }

      // Check squad size and position limits
      const managerSquad = await prisma.squad.findFirst({
        where: { managerId, phase: 1 },
        include: {
          players: {
            include: {
              player: {
                select: { elementType: true }
              }
            }
          }
        }
      })

      const currentSquadSize = managerSquad?.players.length || 0
      if (currentSquadSize >= 11) {
        return NextResponse.json(
          { error: `${manager.username}'s squad is full (maximum 11 players)` },
          { status: 400 }
        )
      }

      // Check position limits
      const positionLimits = { GK: 1, DEF: 4, MID: 5, FWD: 3 }
      const currentPositionCounts = { GK: 0, DEF: 0, MID: 0, FWD: 0 }
      
      if (managerSquad) {
        for (const squadPlayer of managerSquad.players) {
          const position = squadPlayer.player.elementType
          currentPositionCounts[position]++
        }
      }

      const playerPosition = lot.player.elementType
      if (currentPositionCounts[playerPosition] >= positionLimits[playerPosition]) {
        const positionNames = { GK: 'Goalkeeper', DEF: 'Defender', MID: 'Midfielder', FWD: 'Forward' }
        return NextResponse.json(
          { 
            error: `${manager.username} already has maximum ${positionLimits[playerPosition]} ${positionNames[playerPosition]}${positionLimits[playerPosition] > 1 ? 's' : ''} (has ${currentPositionCounts[playerPosition]})` 
          },
          { status: 400 }
        )
      }
    }

    await prisma.$transaction(async (tx) => {
      let winnerId: string | null = null
      let finalPrice = 0

      if (managerId && priceHalfM > 0) {
        // Manual allocation to specific manager
        console.log('Manual allocation to manager:', managerId, 'price:', priceHalfM)
        winnerId = managerId
        finalPrice = priceHalfM
      } else if (managerId === null && priceHalfM === 0) {
        // SOLD TO HIGHEST BIDDER - find highest bidder automatically
        console.log('Finding highest bidder for lot:', lotId)
        const highestBid = await tx.bid.findFirst({
          where: { lotId },
          orderBy: { amountHalfM: 'desc' },
          include: { manager: true },
        })

        console.log('Highest bid found:', highestBid)
        if (highestBid) {
          winnerId = highestBid.managerId
          finalPrice = highestBid.amountHalfM
          console.log('Allocating to highest bidder:', winnerId, 'price:', finalPrice)
        } else {
          console.log('No bids found for lot:', lotId)
          // If this flow was explicitly "sell to highest", but there are no bids, treat as unsold
          winnerId = null
          finalPrice = 0
        }
      }

      console.log('Final allocation - winnerId:', winnerId, 'finalPrice:', finalPrice)

      // Update the lot as sold
      await tx.auctionLot.update({
        where: { id: lotId },
        data: {
          isSold: true,
          soldPriceHalfM: finalPrice,
          winnerId: winnerId,
        },
      })

      // Clean up any bids on this lot (no longer needed once sold/unsold)
      await tx.bid.deleteMany({ where: { lotId } })

      // If there's a winner, process the sale
      if (winnerId && finalPrice > 0) {
        console.log('Processing sale for winner:', winnerId, 'price:', finalPrice)
        
        // NOTE: budgetKGBP stays at starting value (£150m)
        // Frontend calculates remaining budget based on auction lots: Budget - Spent = Remaining
        
        // Update player ownership
        const lotDetails = await tx.auctionLot.findUnique({
          where: { id: lotId },
          select: { playerId: true },
        })

        console.log('Lot details:', lotDetails)
        if (lotDetails) {
          console.log('Updating player ownership for player:', lotDetails.playerId, 'to manager:', winnerId)
          await tx.player.update({
            where: { id: lotDetails.playerId },
            data: { currentOwnerId: winnerId },
          })

          // Add to manager's squad (Phase 1)
          const squad = await tx.squad.findFirst({
            where: { managerId: winnerId, phase: 1 },
          })

          console.log('Existing squad:', squad)
          if (squad) {
            console.log('Adding player to existing squad:', squad.id)
            await tx.squadPlayer.create({
              data: {
                squadId: squad.id,
                playerId: lotDetails.playerId,
                feeHalfM: finalPrice
              },
            })
          } else {
            console.log('Creating new squad for manager:', winnerId)
            // Create squad if it doesn't exist
            const newSquad = await tx.squad.create({
              data: {
                managerId: winnerId,
                phase: 1,
              },
            })

            console.log('Created squad:', newSquad.id, 'adding player:', lotDetails.playerId)
            await tx.squadPlayer.create({
              data: {
                squadId: newSquad.id,
                playerId: lotDetails.playerId,
                feeHalfM: finalPrice
              },
            })
          }
        }
      } else {
        console.log('No winner or price is 0, marking as unsold')
      }

      // After selling, advance strictly to the next lot after current
      const auction = await tx.auction.findUnique({
        where: { id: lot.auctionId },
        include: {
          lots: {
            orderBy: [
              { player: { elementType: 'asc' } },
              { player: { nowCostHalfM: 'desc' } },
              { player: { firstName: 'asc' } },
              { player: { secondName: 'asc' } },
            ],
          },
        },
      })

      if (auction) {
        // Find index of the lot we just processed, then move to the next lot in order
        const processedIndex = auction.lots.findIndex(l => l.id === lotId)
        let nextLot = null as typeof auction.lots[number] | null
        
        // Move to the next lot in the ordered list (regardless of sold status)
        if (processedIndex + 1 < auction.lots.length) {
          nextLot = auction.lots[processedIndex + 1]
        }
        
        await tx.auction.update({
          where: { id: lot.auctionId },
          data: {
            currentLotId: nextLot?.id || null,
          },
        })
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Error selling lot:', error)
    return NextResponse.json(
      { error: 'Failed to sell lot' },
      { status: 500 }
    )
  }
}

