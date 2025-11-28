const bcrypt = require('bcrypt')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function createTestManagers() {
  try {
    console.log('👥 Creating test managers...')
    
    const testManagers = [
      { username: 'Manager1', name: 'John Smith', password: 'Password123' },
      { username: 'Manager2', name: 'Sarah Johnson', password: 'Password123' },
      { username: 'Manager3', name: 'Mike Wilson', password: 'Password123' },
      { username: 'Manager4', name: 'Emma Brown', password: 'Password123' },
      { username: 'Manager5', name: 'David Davis', password: 'Password123' },
      { username: 'Manager6', name: 'Lisa Miller', password: 'Password123' },
      { username: 'Manager7', name: 'Tom Anderson', password: 'Password123' },
      { username: 'Manager8', name: 'Kate Taylor', password: 'Password123' },
    ]

    for (const manager of testManagers) {
      // Check if manager already exists
      const existing = await prisma.manager.findUnique({
        where: { username: manager.username }
      })

      if (existing) {
        console.log(`✅ ${manager.username} already exists`)
        continue
      }

      // Hash password
      const passwordHash = await bcrypt.hash(manager.password, 10)
      
      // Create manager
      await prisma.manager.create({
        data: {
          username: manager.username,
          name: manager.name,
          passwordHash: passwordHash,
          budgetKGBP: 150000, // £150m
        }
      })

      console.log(`✅ Created ${manager.username} (${manager.name})`)
    }

    console.log('🎉 Test managers created successfully!')
    console.log('')
    console.log('🔑 Login credentials:')
    testManagers.forEach(m => {
      console.log(`Username: ${m.username} | Password: ${m.password}`)
    })

  } catch (error) {
    console.error('❌ Error creating test managers:', error)
  } finally {
    await prisma.$disconnect()
  }
}

createTestManagers()
