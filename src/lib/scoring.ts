import { prisma } from './prisma'
import { fetchFinishedOrCurrentEventIds, fetchLiveEvent } from './fpl'

export async function updateGameweekPoints(gw: number) {
  try {
    console.log(`Fetching live data for Gameweek ${gw}...`)
    const live = await fetchLiveEvent(gw)
    const phase = gameweekToPhase(gw)

    console.log(`Found ${live.elements.length} players with data for GW${gw}`)

    // First upsert gameweek
    await prisma.gameweek.upsert({
      where: { id: gw },
      create: { id: gw, phase },
      update: { phase },
    })

    // Process players in batches to avoid transaction timeout
    const batchSize = 100
    let updatedCount = 0

    for (let i = 0; i < live.elements.length; i += batchSize) {
      const batch = live.elements.slice(i, i + batchSize)

      await prisma.$transaction(async (tx) => {
        for (const el of batch) {
          await tx.gameweekPlayerPoints.upsert({
            where: { gameweekId_playerId: { gameweekId: gw, playerId: el.id } },
            create: { gameweekId: gw, playerId: el.id, points: el.stats.total_points },
            update: { points: el.stats.total_points },
          })
        }
      })

      updatedCount += batch.length
      console.log(`  Processed ${updatedCount}/${live.elements.length} players...`)
    }

    console.log(`Updated points for ${updatedCount} players in GW${gw}`)
  } catch (error) {
    console.error(`Error updating Gameweek ${gw} points:`, error)
    throw error
  }
}

export function gameweekToPhase(gw: number) {
  if (gw >= 1 && gw <= 10) return 1
  if (gw >= 11 && gw <= 23) return 2
  if (gw >= 24 && gw <= 30) return 3
  return 4
}

/**
 * Resolve the league's current phase from local season data first.
 * After a season reset (no points uploaded), always return Phase 1 so we
 * do not inherit last season's finished gameweeks from the FPL API.
 */
export async function getCurrentPhase(): Promise<{ phase: number; gameweekId: number | null }> {
  const pointsCount = await prisma.gameweekPlayerPoints.count()
  if (pointsCount === 0) {
    return { phase: 1, gameweekId: null }
  }

  let recentGwId: number | null = null

  try {
    const finishedOrCurrent = await fetchFinishedOrCurrentEventIds()
    recentGwId = finishedOrCurrent.length > 0
      ? finishedOrCurrent[finishedOrCurrent.length - 1]
      : null
  } catch (error) {
    console.warn('Failed to fetch FPL data for current phase:', error)
  }

  if (recentGwId === null) {
    const gameweekWithData = await prisma.gameweekPlayerPoints.groupBy({
      by: ['gameweekId'],
      _count: { points: true },
      orderBy: { gameweekId: 'desc' },
      take: 1,
    })
    recentGwId = gameweekWithData.length > 0 ? gameweekWithData[0].gameweekId : null
  }

  return {
    phase: recentGwId ? gameweekToPhase(recentGwId) : 1,
    gameweekId: recentGwId,
  }
}


