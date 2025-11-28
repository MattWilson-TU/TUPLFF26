const bcrypt = require('bcrypt')
const { PrismaClient } = require('@prisma/client')
const fs = require('fs')
const csv = require('csv-parser')

const prisma = new PrismaClient()

async function importManagerTeams() {
  try {
    console.log('📊 Importing manager teams from CSV...')
    
    // Clear existing data
    console.log('🗑️ Clearing existing data...')
    await prisma.bid.deleteMany({})
    await prisma.auctionLot.deleteMany({})
    await prisma.squadPlayer.deleteMany({})
    await prisma.squad.deleteMany({})
    await prisma.transfer.deleteMany({})
    await prisma.gameweekPlayerPoints.deleteMany({})
    await prisma.manager.deleteMany({})
    
    console.log('✅ Cleared existing data')
    
    // Read CSV data
    const managers = new Map()
    const csvData = []
    
    return new Promise((resolve, reject) => {
      fs.createReadStream('manager-teams-export.csv')
        .pipe(csv())
        .on('data', (row) => {
          csvData.push(row)
          const managerName = row.Manager
          if (!managers.has(managerName)) {
            managers.set(managerName, {
              username: managerName,
              name: managerName,
              passwordHash: bcrypt.hashSync('Password', 10),
              budgetKGBP: 150000, // £150m
              squads: []
            })
          }
          
          // Add player to manager's squad
          managers.get(managerName).squads.push({
            playerId: parseInt(row['Player ID']),
            playerName: row['Player Name'],
            position: row.Position,
            team: row.Team,
            feePaidHalfM: Math.round(parseFloat(row['Fee Paid (£m)']) * 2), // Convert to half-million units
            totalPoints: parseInt(row['Total Points']),
            phase: parseInt(row.Phase)
          })
        })
        .on('end', async () => {
          try {
            console.log(`📋 Found ${managers.size} managers in CSV`)
            
            // Create managers
            for (const [username, managerData] of managers) {
              const manager = await prisma.manager.create({
                data: {
                  username: managerData.username,
                  name: managerData.name,
                  passwordHash: managerData.passwordHash,
                  budgetKGBP: managerData.budgetKGBP,
                }
              })
              
              console.log(`✅ Created manager: ${username}`)
              
              // Create squads for this manager
              const phase1Squad = managerData.squads.filter(s => s.phase === 1)
              
              if (phase1Squad.length > 0) {
                // Create Phase 1 squad
                const squad = await prisma.squad.create({
                  data: {
                    managerId: manager.id,
                    phase: 1,
                    players: {
                      create: phase1Squad.map(player => ({
                        playerId: player.playerId
                      }))
                    }
                  }
                })
                
                console.log(`  ✅ Created Phase 1 squad with ${phase1Squad.length} players`)
                
                // Update player ownership
                for (const player of phase1Squad) {
                  await prisma.player.update({
                    where: { id: player.playerId },
                    data: { currentOwnerId: manager.id }
                  })
                }
              }
            }
            
            // Create a default auction first
            const auction = await prisma.auction.upsert({
              where: { id: 'auction-1' },
              update: { status: 'CLOSED' },
              create: {
                id: 'auction-1',
                status: 'CLOSED',
                createdAt: new Date(),
                updatedAt: new Date()
              }
            })
            
            // Create auction lots for all players with their fees
            console.log('🎯 Creating auction lots...')
            for (const row of csvData) {
              const playerId = parseInt(row['Player ID'])
              const feePaidHalfM = Math.round(parseFloat(row['Fee Paid (£m)']) * 2)
              
              // Find the manager who bought this player
              const manager = await prisma.manager.findFirst({
                where: { username: row.Manager }
              })
              
              if (manager) {
                // Create auction lot
                await prisma.auctionLot.create({
                  data: {
                    playerId: playerId,
                    soldPriceHalfM: feePaidHalfM,
                    winnerId: manager.id,
                    isSold: true,
                    auctionId: auction.id
                  }
                })
              }
            }
            
            console.log('✅ Created auction lots')
            
            // Summary
            const totalManagers = await prisma.manager.count()
            const totalPlayers = await prisma.player.count()
            const ownedPlayers = await prisma.player.count({
              where: { currentOwnerId: { not: null } }
            })
            const totalSquads = await prisma.squad.count()
            
            console.log('')
            console.log('🎉 Import completed successfully!')
            console.log('📊 Database Summary:')
            console.log(`  Managers: ${totalManagers}`)
            console.log(`  Total Players: ${totalPlayers}`)
            console.log(`  Owned Players: ${ownedPlayers}`)
            console.log(`  Squads: ${totalSquads}`)
            console.log('')
            console.log('🔑 Login credentials for all managers:')
            console.log('  Username: [Manager Name] | Password: Password')
            
            resolve()
          } catch (error) {
            reject(error)
          }
        })
        .on('error', reject)
    })
    
  } catch (error) {
    console.error('❌ Import failed:', error)
  } finally {
    await prisma.$disconnect()
  }
}

importManagerTeams()
