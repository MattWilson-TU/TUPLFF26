import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // Get current active auction
    const auction = await prisma.auction.findFirst({
      where: { status: 'OPEN' },
      include: {
        lots: {
          include: {
            player: {
              include: { team: true },
            },
            bids: {
              include: {
                manager: {
                  select: { id: true, username: true },
                },
              },
              orderBy: { amountHalfM: 'desc' },
            },
            winner: {
              select: { id: true, username: true },
            },
          },
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
      return NextResponse.json({ auction: null })
    }

    // Find current lot (use currentLotId if set, otherwise first unsold lot)
    let currentLot = null
    if (auction.currentLotId) {
      currentLot = auction.lots.find(lot => lot.id === auction.currentLotId && !lot.isSold)
    }
    if (!currentLot) {
      // If no explicit current lot, choose the first unsold from the start
      currentLot = auction.lots.find(lot => !lot.isSold)
    }
    const currentIndex = currentLot ? auction.lots.indexOf(currentLot) : -1

    return NextResponse.json({
      auction,
      currentLot,
      currentIndex,
      totalLots: auction.lots.length,
    })
  } catch (error) {
    console.error('Error fetching current auction:', error)
    return NextResponse.json(
      { error: 'Failed to fetch current auction' },
      { status: 500 }
    )
  }
}

