#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
// Use built-in fetch for Node.js 18+
const fetch = globalThis.fetch || require('node-fetch')

async function downloadFPLData() {
  try {
    console.log('🚀 Starting FPL data download...')
    
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
          phase: gw <= 10 ? 1 : gw <= 23 ? 2 : gw <= 30 ? 3 : 4,
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
    
    // Save to file
    const filename = `fpl-data-${new Date().toISOString().split('T')[0]}.json`
    const filepath = path.join(__dirname, filename)
    
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2))
    
    console.log(`\n🎉 Data download completed!`)
    console.log(`📁 Saved to: ${filepath}`)
    console.log(`📊 Summary:`)
    console.log(`  - Players: ${Object.keys(data.players).length}`)
    console.log(`  - Teams: ${Object.keys(data.teams).length}`)
    console.log(`  - Gameweeks: ${Object.keys(data.gameweeks).length}`)
    
    const gameweekIds = Object.keys(data.gameweeks).sort((a, b) => parseInt(a) - parseInt(b))
    for (const gw of gameweekIds) {
      const playerCount = Object.keys(data.gameweeks[gw].players).length
      const phase = data.gameweeks[gw].phase
      console.log(`  - GW${gw} (Phase ${phase}): ${playerCount} players`)
    }
    
    console.log(`\n📤 Next steps:`)
    console.log(`1. Go to your web app admin panel`)
    console.log(`2. Use the "Upload FPL Data" feature`)
    console.log(`3. Upload the file: ${filename}`)
    
  } catch (error) {
    console.error('❌ Error downloading FPL data:', error)
    process.exit(1)
  }
}

downloadFPLData()
