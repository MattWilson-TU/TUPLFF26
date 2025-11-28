import { prisma } from './prisma'
import { fetchLiveEvent } from './fpl'

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
  if (gw >= 1 && gw <= 11) return 1
  if (gw >= 12 && gw <= 26) return 2
  if (gw >= 27 && gw <= 31) return 3
  return 4
}


