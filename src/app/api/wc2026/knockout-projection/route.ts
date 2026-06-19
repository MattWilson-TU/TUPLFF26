import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { buildKnockoutProjection } from '@/lib/wc2026-knockout'
import { canAccessWc2026 } from '@/lib/wc2026-participants'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const manager = await prisma.manager.findUnique({
      where: { id: session.user.id },
      select: { wc2026Enabled: true, username: true },
    })
    if (!manager || !canAccessWc2026(manager)) {
      return NextResponse.json({ error: 'You are not enrolled in the WC2026 predictor' }, { status: 403 })
    }

    const fixtures = await prisma.wcFixture.findMany({
      where: { groupName: { not: null } },
      orderBy: { kickoffUtc: 'asc' },
    })

    return NextResponse.json(buildKnockoutProjection(fixtures))
  } catch (error) {
    console.error('Error fetching WC2026 knockout projection:', error)
    return NextResponse.json({ error: 'Failed to fetch knockout projection' }, { status: 500 })
  }
}
