import { NextResponse } from 'next/server'
import { getCurrentPhase } from '@/lib/scoring'

export async function GET() {
  try {
    const { phase, gameweekId } = await getCurrentPhase()
    return NextResponse.json({ phase, gameweekId })
  } catch (error) {
    console.error('current-phase error', error)
    return NextResponse.json({ error: 'Failed to get current phase' }, { status: 500 })
  }
}
