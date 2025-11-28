import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAuctionLot } from '@/lib/auction'

export async function GET() {
  try {
    const auctions = await prisma.auction.findMany({
      include: {
        lots: {
          include: {
            player: true,
            bids: {
              include: {
                manager: true,
              },
              orderBy: { amountHalfM: 'desc' },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(auctions)
  } catch (error) {
    console.error('Error fetching auctions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch auctions' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { playerId, phase = 1 } = body

    if (!playerId) {
      return NextResponse.json(
        { error: 'Player ID is required' },
        { status: 400 }
      )
    }

    // Create or get active auction for this phase
    let auction = await prisma.auction.findFirst({
      where: { phase, status: 'OPEN' },
    })

    if (!auction) {
      auction = await prisma.auction.create({
        data: {
          phase,
          status: 'OPEN',
        },
      })
    }

    // Create auction lot
    const lot = await createAuctionLot(playerId, auction.id)

    return NextResponse.json(lot)
  } catch (error) {
    console.error('Error creating auction lot:', error)
    return NextResponse.json(
      { error: 'Failed to create auction lot' },
      { status: 500 }
    )
  }
}

