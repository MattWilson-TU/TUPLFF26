import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admin can upload data
    if ((session.user as any).username !== 'Admin01') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    
    if (!body.gameweeks || !body.players || !body.teams) {
      return NextResponse.json({ error: 'Invalid data format' }, { status: 400 })
    }

    console.log('📤 Starting FPL data upload...')
    console.log(`  - Players: ${Object.keys(body.players).length}`)
    console.log(`  - Teams: ${Object.keys(body.teams).length}`)
    console.log(`  - Gameweeks: ${Object.keys(body.gameweeks).length}`)
    
    const gameweekIds = Object.keys(body.gameweeks).sort((a, b) => parseInt(a) - parseInt(b))
    console.log(`  - Available gameweeks: ${gameweekIds.join(', ')}`)

    // Update teams first
    console.log('🏟️ Updating teams...')
    for (const [teamId, teamData] of Object.entries(body.teams)) {
      await prisma.team.upsert({
        where: { id: parseInt(teamId) },
        update: {
          name: teamData.name,
          shortName: teamData.shortName
        },
        create: {
          id: parseInt(teamId),
          name: teamData.name,
          shortName: teamData.shortName
        }
      })
    }

    // Update players
    console.log('👥 Updating players...')
    for (const [playerId, playerData] of Object.entries(body.players)) {
      await prisma.player.upsert({
        where: { id: parseInt(playerId) },
        update: {
          firstName: playerData.firstName,
          secondName: playerData.secondName,
          webName: playerData.webName,
          elementType: mapElementTypeToPosition(playerData.elementType),
          nowCostHalfM: costToHalfMillion(playerData.nowCost),
          teamId: playerData.team,
          photo: playerData.photo
        },
        create: {
          id: parseInt(playerId),
          firstName: playerData.firstName,
          secondName: playerData.secondName,
          webName: playerData.webName,
          elementType: mapElementTypeToPosition(playerData.elementType),
          nowCostHalfM: costToHalfMillion(playerData.nowCost),
          teamId: playerData.team,
          photo: playerData.photo
        }
      })
    }

    // Update gameweeks and points
    console.log('📊 Updating gameweeks and points...')
    for (const [gwId, gwData] of Object.entries(body.gameweeks)) {
      const gameweekId = parseInt(gwId)
      
      // Upsert gameweek
      await prisma.gameweek.upsert({
        where: { id: gameweekId },
        update: { phase: gwData.phase },
        create: { id: gameweekId, phase: gwData.phase }
      })

      // Process players in batches to avoid timeout
      const playerEntries = Object.entries(gwData.players)
      const batchSize = 100
      
      for (let i = 0; i < playerEntries.length; i += batchSize) {
        const batch = playerEntries.slice(i, i + batchSize)
        
        await prisma.$transaction(async (tx) => {
          for (const [playerId, playerPoints] of batch) {
            await tx.gameweekPlayerPoints.upsert({
              where: { 
                gameweekId_playerId: { 
                  gameweekId: gameweekId, 
                  playerId: parseInt(playerId) 
                } 
              },
              create: { 
                gameweekId: gameweekId, 
                playerId: parseInt(playerId), 
                points: playerPoints.points 
              },
              update: { 
                points: playerPoints.points 
              }
            })
          }
        })
        
        console.log(`  Processed ${Math.min(i + batchSize, playerEntries.length)}/${playerEntries.length} players for GW${gameweekId}`)
      }
    }

    // Get summary
    const totalGameweeks = await prisma.gameweek.count()
    const totalPoints = await prisma.gameweekPlayerPoints.count()
    const totalPlayers = await prisma.player.count()

    console.log('✅ FPL data upload completed!')

    // Record this database update
    try {
      await prisma.dataUpdate.create({
        data: {
          type: 'FPL_UPLOAD',
          description: `Admin upload for gameweeks: ${gameweekIds.join(', ')}`,
          // completedAt will default to now()
        },
      })
      console.log('🕒 Recorded FPL data upload timestamp')
    } catch (metaError) {
      console.warn('⚠️ Failed to record FPL data upload timestamp:', metaError)
    }

    return NextResponse.json({
      success: true,
      message: 'FPL data uploaded successfully',
      summary: {
        gameweeks: totalGameweeks,
        players: totalPlayers,
        pointEntries: totalPoints,
        timestamp: body.timestamp
      }
    })

  } catch (error) {
    console.error('❌ Error uploading FPL data:', error)
    return NextResponse.json({ error: 'Failed to upload FPL data' }, { status: 500 })
  }
}

function mapElementTypeToPosition(elementType: number) {
  // 1 GK, 2 DEF, 3 MID, 4 FWD
  switch (elementType) {
    case 1: return 'GK'
    case 2: return 'DEF'
    case 3: return 'MID'
    case 4: return 'FWD'
    default: throw new Error(`Unknown element type: ${elementType}`)
  }
}

function costToHalfMillion(now_cost: number) {
  // now_cost is in 0.1m increments. Convert to nearest 0.5m
  const inMillions = now_cost / 10 // e.g. 75 => 7.5m
  const halfUnits = Math.round(inMillions / 0.5) // e.g. 7.5/0.5=15
  return halfUnits
}
