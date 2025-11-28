import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ managerId: string }> }
) {
  try {
    // Check admin authorization
    const session = await getServerSession(authOptions)
    if (!session?.user?.username || session.user.username !== 'Admin01') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { managerId } = await params

    // Get manager's starting budget
    const manager = await prisma.manager.findUnique({
      where: { id: managerId },
      select: { budgetKGBP: true }
    })

    if (!manager) {
      return NextResponse.json({ error: 'Manager not found' }, { status: 404 })
    }

    const startingBudgetHalfM = Math.floor(manager.budgetKGBP / 500)

    // Calculate total spent from auction lots
    const currentAuction = await prisma.auction.findFirst({
      where: { status: 'OPEN' },
      include: {
        lots: {
          where: { winnerId: managerId, isSold: true }
        }
      }
    })

    const spentHalfM = currentAuction?.lots.reduce(
      (sum, lot) => sum + (lot.soldPriceHalfM || 0), 
      0
    ) || 0

    const remainingHalfM = startingBudgetHalfM - spentHalfM

    return NextResponse.json({
      startingBudgetHalfM,
      spentHalfM,
      remainingHalfM
    })

  } catch (error) {
    console.error('Error fetching manager budget:', error)
    return NextResponse.json({ error: 'Failed to fetch budget' }, { status: 500 })
  }
}
