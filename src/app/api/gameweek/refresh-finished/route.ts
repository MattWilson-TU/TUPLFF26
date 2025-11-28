import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { fetchFinishedOrCurrentEventIds } from '@/lib/fpl'
import { updateGameweekPoints } from '@/lib/scoring'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admin can trigger refresh
    if ((session.user as any).username !== 'Admin01') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    let ids: number[] = []
    
    try {
      // Try to get finished/current gameweeks from FPL API
      ids = await fetchFinishedOrCurrentEventIds()
      console.log('Fetched gameweeks from FPL API:', ids)
    } catch (error) {
      console.warn('Failed to fetch from FPL bootstrap API, using fallback:', error)
      // Fallback: manually specify the first 4 gameweeks since we know they have data
      ids = [1, 2, 3, 4]
      console.log('Using fallback gameweeks:', ids)
    }

    const updatedGameweeks: number[] = []
    
    for (const gw of ids) {
      try {
        await updateGameweekPoints(gw)
        updatedGameweeks.push(gw)
        console.log(`Successfully updated Gameweek ${gw}`)
      } catch (error) {
        console.error(`Failed to update Gameweek ${gw}:`, error)
        // Continue with other gameweeks even if one fails
      }
    }

    return NextResponse.json({ 
      success: true, 
      updatedGameweeks,
      message: `Updated ${updatedGameweeks.length} gameweeks: ${updatedGameweeks.join(', ')}`
    })
  } catch (error) {
    console.error('refresh-finished error', error)
    return NextResponse.json({ error: 'Failed to refresh gameweeks' }, { status: 500 })
  }
}
