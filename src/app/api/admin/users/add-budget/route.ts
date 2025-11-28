import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const addBudgetSchema = z.object({
  amount: z.number().int().min(0, 'Amount must be positive'),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.username || session.user.username !== 'Admin01') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { amount } = addBudgetSchema.parse(body)

    // Add the specified amount to all managers' budgets (excluding Admin01)
    const result = await prisma.manager.updateMany({
      where: { 
        username: { not: 'Admin01' } // Exclude admin account
      },
      data: {
        budgetKGBP: {
          increment: amount
        }
      }
    })

    return NextResponse.json({ 
      success: true, 
      message: `Successfully added £${(amount / 1000).toFixed(1)}m to ${result.count} managers' budgets`,
      updatedCount: result.count
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error adding budget to all users:', error)
    return NextResponse.json(
      { error: 'Failed to add budget to all users' },
      { status: 500 }
    )
  }
}
