import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const skipToPlayerSchema = z.object({
  lotId: z.string(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.username || session.user.username !== 'Admin01') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { lotId } = skipToPlayerSchema.parse(body)

    // Verify the lot exists and is not sold
    const lot = await prisma.auctionLot.findUnique({
      where: { id: lotId },
      include: { auction: true },
    })

    if (!lot) {
      return NextResponse.json(
        { error: 'Lot not found' },
        { status: 400 }
      )
    }

    // Update auction to set current lot index
    // We'll need to find the index of this lot in the auction
    const auction = await prisma.auction.findUnique({
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

    if (!auction) {
      return NextResponse.json(
        { error: 'Auction not found' },
        { status: 400 }
      )
    }

    const lotIndex = auction.lots.findIndex(l => l.id === lotId)
    
    // Optionally reopen the lot by clearing sold state if requested later
    await prisma.auction.update({
      where: { id: lot.auctionId },
      data: { 
        status: 'OPEN', // Ensure it's still open
        currentLotId: lotId, // Set the current lot
      },
    })

    return NextResponse.json({ 
      success: true, 
      lotIndex,
      totalLots: auction.lots.length 
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Error skipping to player:', error)
    return NextResponse.json(
      { error: 'Failed to skip to player' },
      { status: 500 }
    )
  }
}
