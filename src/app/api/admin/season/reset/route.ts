import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.username || session.user.username !== 'Admin01') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const summary = await prisma.$transaction(async (tx) => {
      const bids = await tx.bid.deleteMany({})
      const auctionLots = await tx.auctionLot.deleteMany({})
      const auctions = await tx.auction.deleteMany({})
      const squadPlayers = await tx.squadPlayer.deleteMany({})
      const squads = await tx.squad.deleteMany({})
      const transfers = await tx.transfer.deleteMany({})
      const gameweekPoints = await tx.gameweekPlayerPoints.deleteMany({})
      const players = await tx.player.deleteMany({})
      const teams = await tx.team.deleteMany({})

      const managers = await tx.manager.updateMany({
        where: { username: { not: 'Admin01' } },
        data: { budgetKGBP: 150000 },
      })

      await tx.gameweek.updateMany({
        data: { startedAt: null, completedAt: null },
      })

      await tx.dataSync.upsert({
        where: { id: 'singleton' },
        create: { id: 'singleton', lastSyncedAt: new Date(0) },
        update: { lastSyncedAt: new Date(0) },
      })

      return {
        bids: bids.count,
        auctionLots: auctionLots.count,
        auctions: auctions.count,
        squadPlayers: squadPlayers.count,
        squads: squads.count,
        transfers: transfers.count,
        gameweekPoints: gameweekPoints.count,
        players: players.count,
        teams: teams.count,
        managersReset: managers.count,
      }
    })

    return NextResponse.json({ success: true, summary })
  } catch (error) {
    console.error('Error resetting season:', error)
    return NextResponse.json(
      { error: 'Failed to reset season' },
      { status: 500 }
    )
  }
}
