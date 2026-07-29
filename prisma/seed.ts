import { PrismaClient, Position } from '@prisma/client'
import { fetchBootstrap, costToHalfMillion } from '../src/lib/fpl'

const prisma = new PrismaClient()

function mapElementTypeToPosition(elementType: number): Position {
  // 1 GK, 2 DEF, 3 MID, 4 FWD
  switch (elementType) {
    case 1:
      return Position.GK
    case 2:
      return Position.DEF
    case 3:
      return Position.MID
    case 4:
      return Position.FWD
    default:
      throw new Error(`Unknown element type: ${elementType}`)
  }
}

async function main() {
  console.log('🌱 Starting database seed...')

  // Fetch player data from FPL API
  console.log('📡 Fetching player data from FPL API...')
  const bootstrap = await fetchBootstrap()
  
  console.log(`📊 Found ${bootstrap.elements.length} players`)

  // Clear existing data in the right order (respecting foreign key constraints)
  await prisma.bid.deleteMany({})
  console.log('🗑️ Cleared existing bids')

  await prisma.auctionLot.deleteMany({})
  console.log('🗑️ Cleared existing auction lots')

  await prisma.squadPlayer.deleteMany({})
  console.log('🗑️ Cleared existing squad players')

  await prisma.transfer.deleteMany({})
  console.log('🗑️ Cleared existing transfers')

  await prisma.gameweekPlayerPoints.deleteMany({})
  console.log('🗑️ Cleared existing gameweek player points')

  await prisma.player.deleteMany({})
  console.log('🗑️ Cleared existing players')

  await prisma.team.deleteMany({})
  console.log('🗑️ Cleared existing teams')


  // Seed teams
  const teams = (bootstrap as any).teams as { id: number; name: string; short_name: string; code: number }[]
  await prisma.team.createMany({
    data: teams.map(t => ({ id: t.id, name: t.name, shortName: t.short_name, code: t.code })),
    skipDuplicates: true,
  })
  console.log(`✅ Created ${teams.length} teams`)

  // Seed players
  const players = bootstrap.elements.map(player => ({
    id: player.id,
    firstName: player.first_name,
    secondName: player.second_name,
    webName: player.web_name,
    elementType: mapElementTypeToPosition(player.element_type),
    nowCostHalfM: costToHalfMillion(player.now_cost),
    teamId: player.team,
    totalPoints: player.total_points,
    photo: player.photo,
  }))

  await prisma.player.createMany({
    data: players,
  })
  console.log(`✅ Created ${players.length} players`)

  // Create initial gameweeks
  const gameweeks = Array.from({ length: 38 }, (_, i) => ({
    id: i + 1,
    phase: i < 10 ? 1 : i < 23 ? 2 : i < 30 ? 3 : 4,
  }))

  await prisma.gameweek.createMany({
    data: gameweeks,
    skipDuplicates: true,
  })
  console.log('✅ Created 38 gameweeks')

  // Seed default admin if not exists
  const adminUsername = 'Admin01'
  const bcrypt = require('bcrypt') as typeof import('bcrypt')
  const adminPasswordHash = bcrypt.hashSync('Admin01', 12)
  const existingAdmin = await prisma.manager.findUnique({ where: { username: adminUsername } })
  if (!existingAdmin) {
    await prisma.manager.create({
      data: {
        username: adminUsername,
        name: 'Administrator',
        passwordHash: adminPasswordHash,
        budgetKGBP: 150000,
      },
    })
    console.log('👑 Seeded default admin account: Admin01 / Admin01')
  }

  console.log('🎉 Database seeded successfully!')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
