export const wc2026ParticipantWhere = {
  username: { not: 'Admin01' },
  wc2026Enabled: true,
} as const

export function isWc2026Participant(manager: {
  username: string
  wc2026Enabled: boolean
}): boolean {
  return manager.username !== 'Admin01' && manager.wc2026Enabled
}
