#!/usr/bin/env node

const fs = require('fs')
const fetch = globalThis.fetch || require('node-fetch')

async function testUpload() {
  try {
    console.log('🧪 Testing FPL data upload...')
    
    // Read the downloaded data
    const dataFile = 'fpl-data-2025-09-20.json'
    if (!fs.existsSync(dataFile)) {
      console.error('❌ Data file not found:', dataFile)
      process.exit(1)
    }
    
    const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'))
    console.log(`📁 Loaded data file: ${dataFile}`)
    console.log(`  - Players: ${Object.keys(data.players).length}`)
    console.log(`  - Teams: ${Object.keys(data.teams).length}`)
    console.log(`  - Gameweeks: ${Object.keys(data.gameweeks).length}`)
    
    // Check Haaland's data
    const haaland = data.players['430']
    if (haaland) {
      console.log(`\n🔍 Haaland data in file:`)
      console.log(`  - Name: ${haaland.firstName} ${haaland.secondName}`)
      console.log(`  - Web Name: ${haaland.webName}`)
      console.log(`  - Element Type: ${haaland.elementType}`)
      
      let totalPoints = 0
      for (const [gw, gwData] of Object.entries(data.gameweeks)) {
        const playerData = gwData.players['430']
        if (playerData) {
          console.log(`  - GW${gw}: ${playerData.points} points`)
          totalPoints += playerData.points
        }
      }
      console.log(`  - Total: ${totalPoints} points`)
    } else {
      console.log('❌ Haaland not found in data')
    }
    
    // Test upload to the API
    console.log('\n📤 Testing upload to API...')
    
    const response = await fetch('https://web-app-884572147716.europe-west2.run.app/api/admin/upload-fpl-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Note: This will fail authentication, but we can see the response
      },
      body: JSON.stringify(data)
    })
    
    console.log(`📊 Response status: ${response.status}`)
    console.log(`📊 Response headers:`, Object.fromEntries(response.headers.entries()))
    
    const responseText = await response.text()
    console.log(`📊 Response body:`, responseText)
    
    if (response.ok) {
      console.log('✅ Upload successful!')
    } else {
      console.log('❌ Upload failed')
      console.log('Note: Authentication required - you need to upload via the web interface')
    }
    
  } catch (error) {
    console.error('❌ Error testing upload:', error)
  }
}

testUpload()
