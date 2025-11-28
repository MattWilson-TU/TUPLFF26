import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const reopenSchema = z.object({
  lotId: z.string(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.username || session.user.username !== 'Admin01') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { lotId } = reopenSchema.parse(body)

    const lot = await prisma.auctionLot.findUnique({ where: { id: lotId }, select: { id: true, auctionId: true, playerId: true, isSold: true, soldPriceHalfM: true, winnerId: true } })
    if (!lot) {
      return NextResponse.json({ error: 'Lot not found' }, { status: 400 })
    }

    await prisma.$transaction(async (tx) => {
      // If there was a winner, revert ownership (budget stays at starting value)
      if (lot.winnerId && (lot.soldPriceHalfM || 0) > 0) {
        // NOTE: budgetKGBP stays at starting value (£150m)
        // Frontend calculates remaining budget based on auction lots: Budget - Spent = Remaining

        // Remove ownership from player
        await tx.player.update({ where: { id: lot.playerId }, data: { currentOwnerId: null } })

        // Remove from the manager's phase 1 squad if present
        const squad = await tx.squad.findFirst({ where: { managerId: lot.winnerId, phase: 1 } })
        if (squad) {
          await tx.squadPlayer.deleteMany({ where: { squadId: squad.id, playerId: lot.playerId } })
        }
      }

      // Clear sold state and bids to reopen
      await tx.bid.deleteMany({ where: { lotId } })
      await tx.auctionLot.update({
        where: { id: lotId },
        data: { isSold: false, soldPriceHalfM: null, winnerId: null },
      })

      await tx.auction.update({
        where: { id: lot.auctionId },
        data: { status: 'OPEN', currentLotId: lotId },
      })
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error reopening lot:', error)
    return NextResponse.json({ error: 'Failed to reopen lot' }, { status: 500 })
  }
}
