#!/usr/bin/env node

// Use built-in fetch for Node.js 18+
const fetch = globalThis.fetch || require('node-fetch')
const { PrismaClient } = require('@prisma/client')

// Initialize Prisma client
const prisma = new PrismaClient({
  log: ['error'],
})

// Helper functions from upload route
function mapElementTypeToPosition(elementType) {
  // 1 GK, 2 DEF, 3 MID, 4 FWD
  switch (elementType) {
    case 1: return 'GK'
    case 2: return 'DEF'
    case 3: return 'MID'
    case 4: return 'FWD'
    default: throw new Error(`Unknown element type: ${elementType}`)
  }
}

function costToHalfMillion(now_cost) {
  // now_cost is in 0.1m increments. Convert to nearest 0.5m
  const inMillions = now_cost / 10 // e.g. 75 => 7.5m
  const halfUnits = Math.round(inMillions / 0.5) // e.g. 7.5/0.5=15
  return halfUnits
}

async function downloadAndUpdateFPLData() {
  try {
    console.log('🚀 Starting FPL data download and update...')
    
    const data = {
      gameweeks: {},
      players: {},
      teams: {},
      timestamp: new Date().toISOString()
    }
    
    // Download bootstrap data (players and teams)
    console.log('📊 Downloading bootstrap data...')
    const bootstrapRes = await fetch('https://fantasy.premierleague.com/api/bootstrap-static/')
    if (!bootstrapRes.ok) {
      throw new Error(`Failed to fetch bootstrap: ${bootstrapRes.status}`)
    }
    
    const bootstrap = await bootstrapRes.json()
    
    // Store player data
    for (const player of bootstrap.elements) {
      data.players[player.id] = {
        id: player.id,
        firstName: player.first_name,
        secondName: player.second_name,
        webName: player.web_name,
        elementType: player.element_type,
        nowCost: player.now_cost,
        team: player.team,
        photo: player.photo
      }
    }
    
    // Store team data
    for (const team of bootstrap.teams) {
      data.teams[team.id] = {
        id: team.id,
        name: team.name,
        shortName: team.short_name
      }
    }
    
    console.log(`✅ Downloaded ${Object.keys(data.players).length} players and ${Object.keys(data.teams).length} teams`)
    
    // Determine available gameweeks from bootstrap data
    const availableGameweeks = bootstrap.events
      .filter(event => event.finished || event.is_current)
      .map(event => event.id)
      .sort((a, b) => a - b)
    
    console.log(`📅 Found ${availableGameweeks.length} available gameweeks: ${availableGameweeks.join(', ')}`)
    
    // Download live data for each available gameweek
    for (const gw of availableGameweeks) {
      console.log(`📈 Downloading Gameweek ${gw} live data...`)
      
      try {
        const liveRes = await fetch(`https://fantasy.premierleague.com/api/event/${gw}/live/`)
        if (!liveRes.ok) {
          console.warn(`⚠️ Failed to fetch GW${gw}: ${liveRes.status} - ${liveRes.statusText}`)
          continue
        }
        
        const live = await liveRes.json()
        
        // Check if we have valid data
        if (!live.elements || !Array.isArray(live.elements)) {
          console.warn(`⚠️ GW${gw} has no valid player data`)
          continue
        }
        
        // Store gameweek points data
        data.gameweeks[gw] = {
          gameweekId: gw,
          phase: gw <= 11 ? 1 : gw <= 26 ? 2 : gw <= 31 ? 3 : 4,
          players: {}
        }
        
        for (const element of live.elements) {
          data.gameweeks[gw].players[element.id] = {
            playerId: element.id,
            points: element.stats.total_points,
            minutes: element.stats.minutes,
            goalsScored: element.stats.goals_scored,
            assists: element.stats.assists,
            cleanSheets: element.stats.clean_sheets,
            saves: element.stats.saves,
            bonus: element.stats.bonus
          }
        }
        
        console.log(`✅ Downloaded GW${gw}: ${Object.keys(data.gameweeks[gw].players).length} players`)
        
        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000))
        
      } catch (error) {
        console.error(`❌ Error downloading GW${gw}:`, error.message)
        // Continue with other gameweeks even if one fails
      }
    }
    
    // Validate data structure
    if (!data.gameweeks || !data.players || !data.teams) {
      throw new Error('Invalid data format after download')
    }

    console.log('📤 Starting FPL data upload to database...')
    console.log(`  - Players: ${Object.keys(data.players).length}`)
    console.log(`  - Teams: ${Object.keys(data.teams).length}`)
    console.log(`  - Gameweeks: ${Object.keys(data.gameweeks).length}`)
    
    const gameweekIds = Object.keys(data.gameweeks).sort((a, b) => parseInt(a) - parseInt(b))
    console.log(`  - Available gameweeks: ${gameweekIds.join(', ')}`)

    // Update teams first
    console.log('🏟️ Updating teams...')
    for (const [teamId, teamData] of Object.entries(data.teams)) {
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
    for (const [playerId, playerData] of Object.entries(data.players)) {
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
    for (const [gwId, gwData] of Object.entries(data.gameweeks)) {
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

    console.log('\n✅ FPL data download and update completed!')
    console.log(`📊 Summary:`)
    console.log(`  - Gameweeks: ${totalGameweeks}`)
    console.log(`  - Players: ${totalPlayers}`)
    console.log(`  - Point Entries: ${totalPoints}`)
    console.log(`  - Timestamp: ${data.timestamp}`)
    
    const gameweekIdsSummary = Object.keys(data.gameweeks).sort((a, b) => parseInt(a) - parseInt(b))
    for (const gw of gameweekIdsSummary) {
      const playerCount = Object.keys(data.gameweeks[gw].players).length
      const phase = data.gameweeks[gw].phase
      console.log(`  - GW${gw} (Phase ${phase}): ${playerCount} players`)
    }
    
  } catch (error) {
    console.error('❌ Error downloading/updating FPL data:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

downloadAndUpdateFPLData()

