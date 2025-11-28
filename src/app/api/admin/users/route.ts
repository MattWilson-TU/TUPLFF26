import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import bcrypt from 'bcrypt'

const userSchema = z.object({
  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/),
  name: z.string().min(2),
  password: z.string().min(6).optional(),
  budgetKGBP: z.number().int().min(0).optional(),
})

async function ensureAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.username || session.user.username !== 'Admin01') {
    return null
  }
  return session
}

export async function GET() {
  const session = await ensureAdmin()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const users = await prisma.manager.findMany({
    select: { id: true, username: true, name: true, budgetKGBP: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(users)
}

export async function POST(request: NextRequest) {
  const session = await ensureAdmin()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const data = await request.json()
  const parsed = userSchema.parse(data)
  const passwordHash = parsed.password ? await bcrypt.hash(parsed.password, 12) : undefined

  const created = await prisma.manager.create({
    data: {
      username: parsed.username,
      name: parsed.name,
      passwordHash: passwordHash ?? await bcrypt.hash('changeme', 12),
      budgetKGBP: parsed.budgetKGBP ?? 150000,
    },
    select: { id: true, username: true, name: true, budgetKGBP: true },
  })
  return NextResponse.json(created)
}

export async function PUT(request: NextRequest) {
  const session = await ensureAdmin()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const data = await request.json()
  const parsed = userSchema.extend({ id: z.string() }).partial().parse(data)

  const updateData: any = {}
  if (parsed.username) updateData.username = parsed.username
  if (parsed.name) updateData.name = parsed.name
  if (parsed.budgetKGBP !== undefined) updateData.budgetKGBP = parsed.budgetKGBP
  if (parsed.password) updateData.passwordHash = await bcrypt.hash(parsed.password, 12)

  const updated = await prisma.manager.update({
    where: { id: parsed.id! },
    data: updateData,
    select: { id: true, username: true, name: true, budgetKGBP: true },
  })
  return NextResponse.json(updated)
}

export async function DELETE(request: NextRequest) {
  const session = await ensureAdmin()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  try {
    // Use a transaction to handle cascade deletion
    await prisma.$transaction(async (tx) => {
      // Delete related data first
      await tx.bid.deleteMany({ where: { managerId: id } })
      await tx.squadPlayer.deleteMany({ 
        where: { 
          squad: { managerId: id } 
        } 
      })
      await tx.squad.deleteMany({ where: { managerId: id } })
      await tx.transfer.deleteMany({ where: { managerId: id } })
      await tx.auctionLot.updateMany({ 
        where: { winnerId: id },
        data: { winnerId: null }
      })
      await tx.player.updateMany({
        where: { currentOwnerId: id },
        data: { currentOwnerId: null }
      })
      
      // Finally delete the manager
      await tx.manager.delete({ where: { id } })
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting user:', error)
    return NextResponse.json(
      { error: 'Failed to delete user. They may have active data that prevents deletion.' },
      { status: 400 }
    )
  }
}






