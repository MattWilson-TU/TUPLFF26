#!/usr/bin/env node

const fs = require('fs')
const fetch = globalThis.fetch || require('node-fetch')

async function uploadGW4Only() {
  try {
    console.log('🧪 Uploading only GW4 data...')
    
    // Read the downloaded data
    const dataFile = 'fpl-data-2025-09-20.json'
    const fullData = JSON.parse(fs.readFileSync(dataFile, 'utf8'))
    
    // Create a subset with only GW4 data
    const gw4Data = {
      gameweeks: {
        "4": fullData.gameweeks["4"]
      },
      players: fullData.players,
      teams: fullData.teams,
      timestamp: new Date().toISOString()
    }
    
    console.log(`📁 GW4 data prepared:`)
    console.log(`  - Players in GW4: ${Object.keys(gw4Data.gameweeks["4"].players).length}`)
    
    // Check Haaland's GW4 data specifically
    const haalandGW4 = gw4Data.gameweeks["4"].players["430"]
    if (haalandGW4) {
      console.log(`  - Haaland GW4: ${haalandGW4.points} points`)
    } else {
      console.log(`  - Haaland GW4: NOT FOUND`)
    }
    
    console.log('\n📤 Uploading GW4 data...')
    console.log('Note: This will fail authentication, but we can see if the data structure is correct')
    
    const response = await fetch('https://web-app-884572147716.europe-west2.run.app/api/admin/upload-fpl-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(gw4Data)
    })
    
    console.log(`📊 Response status: ${response.status}`)
    const responseText = await response.text()
    console.log(`📊 Response body:`, responseText)
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

uploadGW4Only()
