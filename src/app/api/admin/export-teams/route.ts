import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    // Check admin authorization
    const session = await getServerSession(authOptions)
    if (!session?.user?.username || session.user.username !== 'Admin01') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all managers with their squads
    const managers = await prisma.manager.findMany({
      where: {
        username: { not: 'Admin01' } // Exclude admin
      },
      include: {
        squads: {
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
        }
      }
    })

    // Get auction lots to get the fees paid for each player
    const auction = await prisma.auction.findFirst({
      where: { status: 'OPEN' },
      include: {
        lots: {
          where: { isSold: true },
          select: {
            playerId: true,
            soldPriceHalfM: true,
            winnerId: true
          }
        }
      }
    })

    // Create CSV data
    const csvRows = []
    
    // Add header row
    csvRows.push([
      'Manager',
      'Phase',
      'Player ID',
      'Player Name',
      'Position',
      'Team',
      'Fee Paid (£m)',
      'Total Points'
    ])

    // Add data rows
    for (const manager of managers) {
      for (const squad of manager.squads) {
        for (const squadPlayer of squad.players) {
          const auctionLot = auction?.lots.find(
            lot => lot.playerId === squadPlayer.playerId && lot.winnerId === manager.id
          )
          
          const feePaid = auctionLot?.soldPriceHalfM ? (auctionLot.soldPriceHalfM / 2) : 0
          
          csvRows.push([
            manager.username,
            squad.phase.toString(),
            squadPlayer.player.id.toString(),
            squadPlayer.player.webName || `${squadPlayer.player.firstName} ${squadPlayer.player.secondName}`,
            squadPlayer.player.elementType,
            squadPlayer.player.team.name,
            feePaid.toFixed(1),
            squadPlayer.player.totalPoints?.toString() || '0'
          ])
        }
      }
    }

    // Convert to CSV string
    const csvContent = csvRows.map(row => 
      row.map(field => `"${field.toString().replace(/"/g, '""')}"`).join(',')
    ).join('\n')

    // Return CSV file
    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="manager-teams-export.csv"'
      }
    })

  } catch (error) {
    console.error('Error exporting teams:', error)
    return NextResponse.json({ error: 'Failed to export teams' }, { status: 500 })
  }
}
