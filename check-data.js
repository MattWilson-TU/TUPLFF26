const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function checkData() {
  try {
    console.log('🔍 Checking database data...')
    
    // Check managers
    const managerCount = await prisma.manager.count()
    const managers = await prisma.manager.findMany({
      where: { username: { not: 'Admin01' } },
      select: { username: true, name: true }
    })
    console.log(`📊 Total managers: ${managerCount}`)
    console.log(`👥 Non-admin managers: ${managers.length}`)
    managers.forEach(m => console.log(`  - ${m.username} (${m.name})`))
    
    // Check squads
    const squadCount = await prisma.squad.count()
    console.log(`⚽ Total squads: ${squadCount}`)
    
    // Check squad players
    const squadPlayerCount = await prisma.squadPlayer.count()
    console.log(`👤 Total squad players: ${squadPlayerCount}`)
    
    // Check auction lots
    const auctionLotCount = await prisma.auctionLot.count()
    const soldLots = await prisma.auctionLot.count({ where: { isSold: true } })
    console.log(`🎯 Total auction lots: ${auctionLotCount}`)
    console.log(`💰 Sold lots: ${soldLots}`)
    
    // Check gameweeks
    const gameweekCount = await prisma.gameweek.count()
    console.log(`📅 Total gameweeks: ${gameweekCount}`)
    
    // Check gameweek player points
    const gppCount = await prisma.gameweekPlayerPoints.count()
    console.log(`📈 Gameweek player points entries: ${gppCount}`)
    
    // Check players
    const playerCount = await prisma.player.count()
    const ownedPlayers = await prisma.player.count({ where: { currentOwnerId: { not: null } } })
    console.log(`⚽ Total players: ${playerCount}`)
    console.log(`👑 Owned players: ${ownedPlayers}`)
    
  } catch (error) {
    console.error('❌ Error checking data:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkData()
