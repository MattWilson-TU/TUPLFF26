import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const dataSync = await prisma.dataSync.findUnique({
      where: { id: 'singleton' }
    })

    return NextResponse.json({
      lastUpdated: dataSync?.lastSyncedAt?.toISOString() || null
    })
  } catch (error) {
    console.error('Error fetching last updated timestamp:', error)
    return NextResponse.json(
      { lastUpdated: null, error: 'Failed to fetch timestamp' },
      { status: 500 }
    )
  }
}

