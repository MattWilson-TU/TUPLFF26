#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'postgresql://fpluser:MyAppPassword123@34.39.28.130:5432/fpl_auction'
    }
  }
})

async function checkDatabase() {
  try {
    console.log('🔍 Checking database state...')
    
    // Check Haaland's player data
    console.log('\n👤 Checking Haaland (Player ID 430)...')
    const haaland = await prisma.player.findUnique({
      where: { id: 430 },
      select: { 
        id: true, 
        firstName: true, 
        secondName: true, 
        webName: true,
        elementType: true,
        currentOwnerId: true
      }
    })
    
    if (haaland) {
      console.log(`✅ Haaland found:`)
      console.log(`  - Name: ${haaland.firstName} ${haaland.secondName}`)
      console.log(`  - Web Name: ${haaland.webName}`)
      console.log(`  - Position: ${haaland.elementType}`)
      console.log(`  - Current Owner: ${haaland.currentOwnerId || 'None'}`)
    } else {
      console.log('❌ Haaland not found in database')
    }
    
    // Check Haaland's gameweek points
    console.log('\n📊 Checking Haaland\'s gameweek points...')
    const haalandPoints = await prisma.gameweekPlayerPoints.findMany({
      where: { playerId: 430 },
      orderBy: { gameweekId: 'asc' }
    })
    
    if (haalandPoints.length > 0) {
      let totalPoints = 0
      console.log('✅ Haaland points found:')
      for (const point of haalandPoints) {
        console.log(`  - GW${point.gameweekId}: ${point.points} points`)
        totalPoints += point.points
      }
      console.log(`  - Total: ${totalPoints} points`)
    } else {
      console.log('❌ No points data found for Haaland')
    }
    
    // Check gameweeks
    console.log('\n📅 Checking gameweeks...')
    const gameweeks = await prisma.gameweek.findMany({
      orderBy: { id: 'asc' }
    })
    
    if (gameweeks.length > 0) {
      console.log('✅ Gameweeks found:')
      for (const gw of gameweeks) {
        console.log(`  - GW${gw.id}: Phase ${gw.phase}`)
      }
    } else {
      console.log('❌ No gameweeks found')
    }
    
    // Check total points entries
    console.log('\n📈 Checking total points entries...')
    const totalPointsEntries = await prisma.gameweekPlayerPoints.count()
    console.log(`Total points entries: ${totalPointsEntries}`)
    
    // Check Rawhide manager
    console.log('\n👨‍💼 Checking Rawhide manager...')
    const rawhide = await prisma.manager.findFirst({
      where: { 
        OR: [
          { username: 'Rawhide' },
          { name: 'Rawhide' }
        ]
      },
      include: {
        squads: {
          include: {
            players: {
              where: { playerId: 430 }
            }
          }
        }
      }
    })
    
    if (rawhide) {
      console.log(`✅ Rawhide found:`)
      console.log(`  - Username: ${rawhide.username}`)
      console.log(`  - Name: ${rawhide.name}`)
      console.log(`  - ID: ${rawhide.id}`)
      
      if (rawhide.squads.length > 0) {
        console.log(`  - Squads: ${rawhide.squads.length}`)
        for (const squad of rawhide.squads) {
          console.log(`    - Phase ${squad.phase}: ${squad.players.length} players`)
          if (squad.players.length > 0) {
            console.log(`      - Haaland owned in Phase ${squad.phase}`)
          }
        }
      }
    } else {
      console.log('❌ Rawhide manager not found')
    }
    
    // Check if Haaland is owned by anyone
    console.log('\n🏠 Checking Haaland\'s ownership...')
    const haalandOwner = await prisma.player.findUnique({
      where: { id: 430 },
      select: { 
        currentOwnerId: true,
        currentOwner: {
          select: { username: true, name: true }
        }
      }
    })
    
    if (haalandOwner?.currentOwner) {
      console.log(`✅ Haaland owned by: ${haalandOwner.currentOwner.username} (${haalandOwner.currentOwner.name})`)
    } else {
      console.log('❌ Haaland not currently owned by anyone')
    }
    
  } catch (error) {
    console.error('❌ Error checking database:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkDatabase()
