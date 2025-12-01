import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { managerId: string; phase: string } }
) {
  try {
    // Check admin authorization
    const session = await getServerSession(authOptions)
    if (!session?.user?.username || session.user.username !== 'Admin01') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const managerId = params.managerId
    const phase = parseInt(params.phase)

    if (isNaN(phase) || phase < 1 || phase > 4) {
      return NextResponse.json({ error: 'Invalid phase' }, { status: 400 })
    }

    // Get the squad for this manager and phase
    const squad = await prisma.squad.findFirst({
      where: { 
        managerId, 
        phase 
      },
      include: {
        players: {
          include: {
            player: {
              include: {
                team: {
                  select: {
                    name: true,
                    shortName: true
                  }
                }
              }
            }
          }
        }
      }
    })

    if (!squad) {
      return NextResponse.json({ 
        squad: null, 
        players: [] 
      })
    }

    // Get auction lots for this manager to get the fees
    // Look for both OPEN and CLOSED auctions to get fee data
    const auction = await prisma.auction.findFirst({
      where: { 
        OR: [
          { status: 'OPEN' },
          { status: 'CLOSED' }
        ]
      },
      include: {
        lots: {
          where: { 
            winnerId: managerId, 
            isSold: true,
            playerId: { in: squad.players.map(sp => sp.playerId) }
          }
        }
      }
    })

    // Map squad players to the format expected by the frontend
    const squadPlayers = squad.players.map(squadPlayer => {
      const auctionLot = auction?.lots.find(lot => lot.playerId === squadPlayer.playerId)
      
      return {
        id: squadPlayer.player.id,
        webName: squadPlayer.player.webName || `${squadPlayer.player.firstName} ${squadPlayer.player.secondName}`,
        elementType: squadPlayer.player.elementType,
        teamName: squadPlayer.player.team.name,
        // Use the fee stored on the squad player if available (for post-phase-1 allocations)
        // Otherwise fallback to the auction lot price (for phase 1 / legacy)
        feeHalfM: squadPlayer.feeHalfM > 0 ? squadPlayer.feeHalfM : (auctionLot?.soldPriceHalfM || 0)
      }
    })

    return NextResponse.json({
      squad: {
        id: squad.id,
        phase: squad.phase,
        totalPoints: squad.totalPoints
      },
      players: squadPlayers
    })

  } catch (error) {
    console.error('Error fetching squad:', error)
    return NextResponse.json({ error: 'Failed to fetch squad' }, { status: 500 })
  }
}
