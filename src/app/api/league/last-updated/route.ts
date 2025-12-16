import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // Use the DataUpdate table to find the most recent database update
    const latestUpdate = await prisma.dataUpdate.findFirst({
      orderBy: { completedAt: 'desc' },
      select: {
        completedAt: true,
        type: true,
        description: true,
      },
    })

    if (!latestUpdate) {
      return NextResponse.json({
        lastUpdatedAt: null,
        type: null,
        description: null,
      })
    }

    return NextResponse.json({
      lastUpdatedAt: latestUpdate.completedAt,
      type: latestUpdate.type,
      description: latestUpdate.description,
    })
  } catch (error) {
    console.error('Error fetching league last-updated time:', error)
    return NextResponse.json(
      { error: 'Failed to fetch league last-updated time' },
      { status: 500 }
    )
  }
}


