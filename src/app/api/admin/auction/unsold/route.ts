import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const unsoldSchema = z.object({
  lotId: z.string(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.username || session.user.username !== 'Admin01') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { lotId } = unsoldSchema.parse(body)

    // Get the lot information first
    const lot = await prisma.auctionLot.findUnique({
      where: { id: lotId },
      select: { auctionId: true },
    })

    if (!lot) {
      return NextResponse.json(
        { error: 'Lot not found' },
        { status: 400 }
      )
    }

    await prisma.$transaction(async (tx) => {
      // Clear all bids for this lot
      await tx.bid.deleteMany({
        where: { lotId },
      })

      // Mark the lot as unsold
      await tx.auctionLot.update({
        where: { id: lotId },
        data: {
          isSold: true,
          soldPriceHalfM: 0,
          winnerId: null,
        },
      })

      // Advance to the next lot in the ordered list
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
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error marking lot as unsold:', error)
    return NextResponse.json(
      { error: 'Failed to mark lot as unsold' },
      { status: 500 }
    )
  }
}
