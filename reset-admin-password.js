const bcrypt = require('bcrypt')
const { PrismaClient } = require('@prisma/client')

// Prisma will automatically use DATABASE_URL from environment
// For Cloud SQL, the format should be: postgresql://user:pass@/db?host=/cloudsql/...
const prisma = new PrismaClient()

async function resetAdminPassword() {
  try {
    console.log('🔍 Looking for Admin01 account...')
    
    // Check if admin exists
    const existingAdmin = await prisma.manager.findUnique({
      where: { username: 'Admin01' }
    })

    if (!existingAdmin) {
      console.log('❌ Admin01 account not found. Creating it...')
      
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
    } else {
      console.log('👤 Admin01 account found. Resetting password...')
      
      // Hash the new password
      const passwordHash = await bcrypt.hash('Password', 10)
      
      // Update the admin's password
      await prisma.manager.update({
        where: { username: 'Admin01' },
        data: { passwordHash: passwordHash }
      })

      console.log('✅ Password reset successfully!')
      console.log('Username: Admin01')
      console.log('New Password: Password')
    }

  } catch (error) {
    console.error('❌ Error resetting admin password:', error)
  } finally {
    await prisma.$disconnect()
  }
}

resetAdminPassword()

