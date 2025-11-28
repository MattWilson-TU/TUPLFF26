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

    // Find the current active auction
    const activeAuction = await prisma.auction.findFirst({
      where: { status: 'OPEN' },
    })

    if (!activeAuction) {
      return NextResponse.json(
        { error: 'No active auction found' },
        { status: 400 }
      )
    }

    // Close the auction
    await prisma.auction.update({
      where: { id: activeAuction.id },
      data: { status: 'CLOSED' },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error ending auction:', error)
    return NextResponse.json(
      { error: 'Failed to end auction' },
      { status: 500 }
    )
  }
}
