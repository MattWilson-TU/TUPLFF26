import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { fetchWorldCup2026Matches, mapMatchToFixtureFields } from '@/lib/football-data'

export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if ((session.user as { username?: string }).username !== 'Admin01') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const token = process.env.FOOTBALL_DATA_API_TOKEN
    if (!token) {
      return NextResponse.json({ error: 'FOOTBALL_DATA_API_TOKEN not configured' }, { status: 500 })
    }

    const matches = await fetchWorldCup2026Matches(token)

    for (const match of matches) {
      const fields = mapMatchToFixtureFields(match)
      await prisma.wcFixture.upsert({
        where: { id: fields.id },
        update: fields,
        create: fields,
      })
    }

    await prisma.wcDataSync.upsert({
      where: { id: 'singleton' },
      update: { lastSyncedAt: new Date() },
      create: { id: 'singleton', lastSyncedAt: new Date() },
    })

    return NextResponse.json({
      success: true,
      fixtures: matches.length,
    })
  } catch (error) {
    console.error('Error syncing WC2026 data:', error)
    return NextResponse.json({ error: 'Failed to sync WC2026 data' }, { status: 500 })
  }
}
