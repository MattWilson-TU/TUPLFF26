import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcrypt'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const registerSchema = z.object({
  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/),
  name: z.string().min(2),
  password: z.string().min(6),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username, name, password } = registerSchema.parse(body)

    // Check if user already exists
    const existingManager = await prisma.manager.findUnique({
      where: { username },
    })

    if (existingManager) {
      return NextResponse.json(
        { error: 'Username already taken' },
        { status: 400 }
      )
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12)

    // Create manager with initial budget of £150m (150,000k)
    const manager = await prisma.manager.create({
      data: {
        username,
        name,
        passwordHash,
        budgetKGBP: 150000, // £150m in thousands
      },
    })

    return NextResponse.json({
      id: manager.id,
      username: manager.username,
      name: manager.name,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Registration error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
