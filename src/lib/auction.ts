/** Auction logic and validation */

import { prisma } from './prisma'
import { Position } from '@prisma/client'

export const ALLOWED_FORMATIONS = [
  { name: '1-3-5-2', positions: { GK: 1, DEF: 3, MID: 5, FWD: 2 } },
  { name: '1-4-4-2', positions: { GK: 1, DEF: 4, MID: 4, FWD: 2 } },
  { name: '1-4-3-3', positions: { GK: 1, DEF: 4, MID: 3, FWD: 3 } },
  { name: '1-4-5-1', positions: { GK: 1, DEF: 4, MID: 5, FWD: 1 } },
] as const

export function validateSquadFormation(players: { elementType: Position }[]) {
  const positionCounts = players.reduce((acc, player) => {
    acc[player.elementType] = (acc[player.elementType] || 0) + 1
    return acc
  }, {} as Record<Position, number>)

  return ALLOWED_FORMATIONS.some(formation => 
    Object.entries(formation.positions).every(([pos, count]) => 
      positionCounts[pos as Position] === count
    )
  )
}

export async function createAuctionLot(playerId: number, auctionId: string) {
  return prisma.auctionLot.create({
    data: {
      auctionId,
      playerId,
    },
    include: {
      player: true,
    },
  })
}

export async function placeBid(lotId: string, managerId: string, amountHalfM: number) {
  // Validate bid amount is in 0.5m increments
  if (amountHalfM <= 0) {
    throw new Error('Bid must be positive')
  }

  // Get current highest bid
  const currentBid = await prisma.bid.findFirst({
    where: { lotId },
    orderBy: { amountHalfM: 'desc' },
  })

  if (currentBid && amountHalfM <= currentBid.amountHalfM) {
    throw new Error('Bid must be higher than current highest bid')
  }

  // Check manager budget
  const manager = await prisma.manager.findUnique({
    where: { id: managerId },
  })

  if (!manager) {
    throw new Error('Manager not found')
  }

  const bidAmountKGBP = amountHalfM * 500 // Convert half-million units to k£
  if (manager.budgetKGBP < bidAmountKGBP) {
    throw new Error('Insufficient budget')
  }

  return prisma.bid.create({
    data: {
      lotId,
      managerId,
      amountHalfM,
    },
  })
}

export async function closeAuctionLot(lotId: string) {
  const highestBid = await prisma.bid.findFirst({
    where: { lotId },
    orderBy: { amountHalfM: 'desc' },
    include: { manager: true },
  })

  if (!highestBid) {
    throw new Error('No bids found for this lot')
  }

  // Update lot as sold
  await prisma.auctionLot.update({
    where: { id: lotId },
    data: {
      isSold: true,
      soldPriceHalfM: highestBid.amountHalfM,
      winnerId: highestBid.managerId,
    },
  })

  // Deduct budget from winner
  const bidAmountKGBP = highestBid.amountHalfM * 500
  await prisma.manager.update({
    where: { id: highestBid.managerId },
    data: {
      budgetKGBP: {
        decrement: bidAmountKGBP,
      },
    },
  })

  return highestBid
}

