import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.username || session.user.username !== 'Admin01') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { phase = 1 } = body

    // Create new auction
    const auction = await prisma.auction.create({
      data: {
        status: 'OPEN',
        phase,
        targetSize: 11,
      },
    })

    // Get all players ordered by position (GK, DEF, MID, FWD) then by rounded price (highest first) then alphabetical
    const players = await prisma.player.findMany({
      include: { team: true },
      orderBy: [
        { elementType: 'asc' }, // GK=1, DEF=2, MID=3, FWD=4
        { nowCostHalfM: 'desc' }, // Highest price first (this will be rounded in the UI)
        { firstName: 'asc' }, // Alphabetical by first name
        { secondName: 'asc' }, // Then by second name
      ],
    })

    // Create auction lots for all players
    const lots = await Promise.all(
      players.map(player =>
        prisma.auctionLot.create({
          data: {
            auctionId: auction.id,
            playerId: player.id,
          },
          include: {
            player: {
              include: { team: true },
            },
          },
        })
      )
    )

    // Set first lot as current
    if (lots.length > 0) {
      await prisma.auction.update({
        where: { id: auction.id },
        data: { currentLotId: lots[0].id },
      })
    }

    return NextResponse.json({
      auction: { ...auction, currentLotId: lots[0]?.id || null },
      lots,
      totalPlayers: players.length,
    })
  } catch (error) {
    console.error('Error starting auction:', error)
    return NextResponse.json(
      { error: 'Failed to start auction' },
      { status: 500 }
    )
  }
}


