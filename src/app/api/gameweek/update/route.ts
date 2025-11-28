import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { updateGameweekPoints } from '@/lib/scoring'
import { z } from 'zod'

const updateSchema = z.object({
  gameweek: z.number().min(1).max(38),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { gameweek } = updateSchema.parse(body)

    await updateGameweekPoints(gameweek)

    return NextResponse.json({ success: true, gameweek })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error updating gameweek:', error)
    return NextResponse.json(
      { error: 'Failed to update gameweek' },
      { status: 500 }
    )
  }
}

