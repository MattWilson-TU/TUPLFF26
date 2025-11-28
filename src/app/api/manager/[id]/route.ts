import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { fetchFinishedOrCurrentEventIds } from '@/lib/fpl'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: managerId } = await params

    // Check if manager exists
    const manager = await prisma.manager.findUnique({
      where: { id: managerId },
      select: { id: true, name: true, username: true }
    })

    if (!manager) {
      return NextResponse.json({ error: 'Manager not found' }, { status: 404 })
    }

    // Don't allow viewing admin
    if (manager.username === 'Admin01') {
      return NextResponse.json({ error: 'Manager not found' }, { status: 404 })
    }

    // Determine current active phase based on finished/current gameweeks
    let finishedOrCurrent: number[] = []
    let currentPhase = 1
    
    try {
      finishedOrCurrent = await fetchFinishedOrCurrentEventIds()
      currentPhase = finishedOrCurrent.length > 0 ? 
        (finishedOrCurrent[finishedOrCurrent.length - 1] <= 11 ? 1 : 
         finishedOrCurrent[finishedOrCurrent.length - 1] <= 26 ? 2 :
         finishedOrCurrent[finishedOrCurrent.length - 1] <= 31 ? 3 : 4) : 1
    } catch (error) {
      console.warn('Failed to fetch FPL data, using fallback:', error)
      // Fallback: assume we're in phase 1 (first 11 gameweeks)
      currentPhase = 1
    }

    // Fetch squads for all phases (players owned across phases)
    const squads = await prisma.squad.findMany({
      where: { managerId: managerId },
      include: {
        players: { include: { player: { include: { team: true } } } },
      },
      orderBy: { phase: 'asc' },
    })

    // Get current phase squad players (who score points)
    const currentSquad = squads.find(s => s.phase === currentPhase)
    const currentPlayerIds = currentSquad?.players.map(sp => sp.playerId) || []

    // Get all players ever owned (for former players section)
    const allPlayerIds = squads.flatMap(s => s.players.map(sp => sp.playerId))
    const ownedPlayers = await prisma.player.findMany({
      where: { currentOwnerId: managerId },
      select: { id: true },
    })
    const allOwnedPlayerIds = Array.from(new Set([...allPlayerIds, ...ownedPlayers.map(p => p.id)]))

    // Gameweek phase mapping
    const gameweeks = await prisma.gameweek.findMany({ orderBy: { id: 'asc' } })
    const phaseToGameweeks: Record<number, number[]> = {}
    const gwIdToPhase: Record<number, number> = {}
    for (const gw of gameweeks) {
      phaseToGameweeks[gw.phase] = phaseToGameweeks[gw.phase] || []
      phaseToGameweeks[gw.phase].push(gw.id)
      gwIdToPhase[gw.id] = gw.phase
    }

    // Fetch sold lots for this manager to get prices
    const soldLots = await prisma.auctionLot.findMany({
      where: { winnerId: managerId, isSold: true, playerId: { in: allOwnedPlayerIds } },
      select: { playerId: true, soldPriceHalfM: true },
      orderBy: { createdAt: 'asc' },
    })
    const playerIdToPrice: Record<number, number> = {}
    for (const lot of soldLots) {
      if (playerIdToPrice[lot.playerId] == null) {
        playerIdToPrice[lot.playerId] = lot.soldPriceHalfM || 0
      }
    }

    // Fetch all points entries for these players and reduce into phases
    const gpp = await prisma.gameweekPlayerPoints.findMany({
      where: { playerId: { in: allOwnedPlayerIds } },
      select: { playerId: true, gameweekId: true, points: true },
    })
    const playerPhasePoints: Record<number, Record<number, number>> = {}
    for (const row of gpp) {
      const phase = gwIdToPhase[row.gameweekId]
      if (!phase) continue
      playerPhasePoints[row.playerId] = playerPhasePoints[row.playerId] || { 1: 0, 2: 0, 3: 0, 4: 0 }
      playerPhasePoints[row.playerId][phase] = (playerPhasePoints[row.playerId][phase] || 0) + row.points
    }

    // Compute overall phase totals (manager totals per phase) - ONLY from current phase players
    const phaseScores: Array<{ phase: number; totalPoints: number }> = [1,2,3,4].map(phase => ({ phase, totalPoints: 0 }))
    for (const pid of currentPlayerIds) {
      const map = playerPhasePoints[pid] || {}
      for (const phase of [1,2,3,4]) {
        phaseScores[phase - 1].totalPoints += map[phase] || 0
      }
    }

    // Build current team players (who score points)
    const currentPlayers = currentSquad?.players.map(sp => {
      const p = sp.player
      const price = playerIdToPrice[p.id] || 0
      const pMap = playerPhasePoints[p.id] || { 1: 0, 2: 0, 3: 0, 4: 0 }
      const total = (pMap[1] || 0) + (pMap[2] || 0) + (pMap[3] || 0) + (pMap[4] || 0)
      return {
        id: p.id,
        firstName: p.firstName,
        secondName: p.secondName,
        webName: (p as any).webName || null,
        elementType: p.elementType,
        team: p.team,
        priceHalfM: price,
        phasePoints: { 1: pMap[1] || 0, 2: pMap[2] || 0, 3: pMap[3] || 0, 4: pMap[4] || 0 },
        totalPoints: total,
      }
    }) || []

    // Build former players (who don't score points anymore)
    const formerPlayerIds = allOwnedPlayerIds.filter(id => !currentPlayerIds.includes(id))
    const formerPlayers = formerPlayerIds.map(pid => {
      const squad = squads.find(s => s.players.some(sp => sp.playerId === pid))
      const player = squad?.players.find(sp => sp.playerId === pid)?.player
      if (!player) return null
      
      const price = playerIdToPrice[pid] || 0
      const pMap = playerPhasePoints[pid] || { 1: 0, 2: 0, 3: 0, 4: 0 }
      const total = (pMap[1] || 0) + (pMap[2] || 0) + (pMap[3] || 0) + (pMap[4] || 0)
      return {
        id: player.id,
        firstName: player.firstName,
        secondName: player.secondName,
        webName: (player as any).webName || null,
        elementType: player.elementType,
        team: player.team,
        priceHalfM: price,
        phasePoints: { 1: pMap[1] || 0, 2: pMap[2] || 0, 3: pMap[3] || 0, 4: pMap[4] || 0 },
        totalPoints: total,
      }
    }).filter(Boolean)

    return NextResponse.json({ 
      id: manager.id,
      name: manager.name,
      username: manager.username,
      currentPlayers, 
      formerPlayers, 
      phaseScores, 
      currentPhase 
    })
  } catch (error) {
    console.error('Error fetching manager data:', error)
    return NextResponse.json({ error: 'Failed to fetch manager data' }, { status: 500 })
  }
}
