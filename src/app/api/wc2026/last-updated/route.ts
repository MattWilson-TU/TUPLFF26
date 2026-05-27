import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const dataSync = await prisma.wcDataSync.findUnique({
      where: { id: 'singleton' },
    })

    return NextResponse.json({
      lastUpdated: dataSync?.lastSyncedAt?.toISOString() || null,
    })
  } catch (error) {
    console.error('Error fetching WC2026 last updated:', error)
    return NextResponse.json(
      { lastUpdated: null, error: 'Failed to fetch timestamp' },
      { status: 500 }
    )
  }
}
