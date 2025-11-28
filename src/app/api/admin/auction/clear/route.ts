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

    await prisma.$transaction(async (tx) => {
      // Clear all auction data
      await tx.bid.deleteMany({})
      await tx.auctionLot.deleteMany({})
      await tx.auction.deleteMany({})
      
      // Clear squad data
      await tx.squadPlayer.deleteMany({})
      await tx.squad.deleteMany({})
      
      // Reset player ownership
      await tx.player.updateMany({
        data: { currentOwnerId: null }
      })
      
      // Reset manager budgets to £150m
      await tx.manager.updateMany({
        where: { username: { not: 'Admin01' } },
        data: { budgetKGBP: 150000 }
      })
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error clearing auction data:', error)
    return NextResponse.json(
      { error: 'Failed to clear auction data' },
      { status: 500 }
    )
  }
}




