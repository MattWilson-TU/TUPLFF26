export const POSITION_LIMITS = { GK: 1, DEF: 4, MID: 5, FWD: 3 } as const
export type AuctionPosition = keyof typeof POSITION_LIMITS

export function formatPriceHalfM(halfMillionUnits: number): string {
  return `£${(halfMillionUnits * 0.5).toFixed(1)}m`
}

export function formatBudgetKGBP(budgetKGBP: number): string {
  return `£${(budgetKGBP / 1000).toFixed(1)}m`
}

export function getRemainingHalfM(budgetKGBP: number, totalSpentHalfM: number): number {
  return Math.floor(budgetKGBP / 500) - totalSpentHalfM
}

export function countPositions<T extends { elementType: AuctionPosition }>(
  players: T[]
): Record<AuctionPosition, number> {
  const counts: Record<AuctionPosition, number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 }
  for (const player of players) {
    counts[player.elementType]++
  }
  return counts
}

export function totalSpentHalfMFromPrices(players: { priceHalfM: number }[]): number {
  return players.reduce((sum, player) => sum + player.priceHalfM, 0)
}
