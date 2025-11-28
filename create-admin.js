const bcrypt = require('bcrypt')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function createAdmin() {
  try {
    console.log('🔍 Checking if admin user exists...')
    
    // Check if admin already exists
    const existingAdmin = await prisma.manager.findUnique({
      where: { username: 'Admin01' }
    })

    if (existingAdmin) {
      console.log('✅ Admin user already exists')
      console.log('Username: Admin01')
      console.log('Name:', existingAdmin.name)
      return
    }

    console.log('👤 Creating admin user...')
    
    // Hash the password
    const passwordHash = await bcrypt.hash('Password', 10)
    
    // Create admin user
    const admin = await prisma.manager.create({
      data: {
        username: 'Admin01',
        name: 'Admin User',
        passwordHash: passwordHash,
        budgetKGBP: 150000, // £150m
      }
    })

    console.log('✅ Admin user created successfully!')
    console.log('Username: Admin01')
    console.log('Password: Password')
    console.log('Name:', admin.name)
    console.log('Budget: £150m')

  } catch (error) {
    console.error('❌ Error creating admin user:', error)
  } finally {
    await prisma.$disconnect()
  }
}

createAdmin()
