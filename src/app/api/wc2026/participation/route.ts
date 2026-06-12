import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isWc2026Participant } from '@/lib/wc2026-participants'

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

    if (!manager) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({ enabled: isWc2026Participant(manager) })
  } catch (error) {
    console.error('Error fetching WC2026 participation:', error)
    return NextResponse.json({ error: 'Failed to fetch participation status' }, { status: 500 })
  }
}
