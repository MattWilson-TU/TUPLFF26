#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client')
const fs = require('fs')

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'postgresql://fpluser:MyAppPassword123@34.39.28.130:5432/fpl_auction'
    }
  }
})

async function addGW4Data() {
  try {
    console.log('🔧 Adding missing GW4 data...')
    
    // Read the downloaded data
    const dataFile = 'fpl-data-2025-09-20.json'
    const fullData = JSON.parse(fs.readFileSync(dataFile, 'utf8'))
    
    const gw4Data = fullData.gameweeks["4"]
    if (!gw4Data) {
      console.log('❌ GW4 data not found in file')
      return
    }
    
    console.log(`📊 GW4 data: ${Object.keys(gw4Data.players).length} players`)
    
    // Check Haaland's GW4 data
    const haalandGW4 = gw4Data.players["430"]
    if (haalandGW4) {
      console.log(`🔍 Haaland GW4: ${haalandGW4.points} points`)
    }
    
    // Ensure GW4 exists
    await prisma.gameweek.upsert({
      where: { id: 4 },
      update: { phase: 1 },
      create: { id: 4, phase: 1 }
    })
    
    console.log('✅ GW4 gameweek created/updated')
    
    // Add GW4 points data in batches
    const playerEntries = Object.entries(gw4Data.players)
    const batchSize = 100
    
    for (let i = 0; i < playerEntries.length; i += batchSize) {
      const batch = playerEntries.slice(i, i + batchSize)
      
      await prisma.$transaction(async (tx) => {
        for (const [playerId, playerPoints] of batch) {
          await tx.gameweekPlayerPoints.upsert({
            where: { 
              gameweekId_playerId: { 
                gameweekId: 4, 
                playerId: parseInt(playerId) 
              } 
            },
            create: { 
              gameweekId: 4, 
              playerId: parseInt(playerId), 
              points: playerPoints.points 
            },
            update: { 
              points: playerPoints.points 
            }
          })
        }
      })
      
      console.log(`  Processed ${Math.min(i + batchSize, playerEntries.length)}/${playerEntries.length} players`)
    }
    
    // Verify Haaland's GW4 data was added
    const haalandGW4Check = await prisma.gameweekPlayerPoints.findUnique({
      where: { 
        gameweekId_playerId: { 
          gameweekId: 4, 
          playerId: 430 
        } 
      }
    })
    
    if (haalandGW4Check) {
      console.log(`✅ Haaland GW4 points added: ${haalandGW4Check.points}`)
    } else {
      console.log('❌ Haaland GW4 points not found after upload')
    }
    
    // Check total points for Haaland
    const allHaalandPoints = await prisma.gameweekPlayerPoints.findMany({
      where: { playerId: 430 },
      orderBy: { gameweekId: 'asc' }
    })
    
    const totalPoints = allHaalandPoints.reduce((sum, p) => sum + p.points, 0)
    console.log(`🎯 Haaland total points: ${totalPoints}`)
    
    console.log('\n✅ GW4 data upload completed!')
    
  } catch (error) {
    console.error('❌ Error adding GW4 data:', error)
  } finally {
    await prisma.$disconnect()
  }
}

addGW4Data()
