export const WC2026_ADMIN_USERNAME = 'Admin01'

export const wc2026ParticipantWhere = {
  username: { not: WC2026_ADMIN_USERNAME },
  wc2026Enabled: true,
} as const

export function isWc2026Admin(username: string): boolean {
  return username === WC2026_ADMIN_USERNAME
}

export function isWc2026Participant(manager: {
  username: string
  wc2026Enabled: boolean
}): boolean {
  return manager.username !== WC2026_ADMIN_USERNAME && manager.wc2026Enabled
}

export function canAccessWc2026(manager: {
  username: string
  wc2026Enabled: boolean
}): boolean {
  return isWc2026Admin(manager.username) || isWc2026Participant(manager)
}
