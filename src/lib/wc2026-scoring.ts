export function scorePrediction(
  pred: { home: number; away: number },
  result: { home: number; away: number }
): number {
  if (pred.home === result.home && pred.away === result.away) return 3
  const predOutcome = Math.sign(pred.home - pred.away)
  const actualOutcome = Math.sign(result.home - result.away)
  return predOutcome === actualOutcome ? 1 : 0
}

export function formatKickoffBst(utcDate: Date | string): string {
  const d = typeof utcDate === 'string' ? new Date(utcDate) : utcDate
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d)
}

export function formatStageLabel(stage: string | null, groupName: string | null): string {
  if (groupName) {
    return groupName.replace('_', ' ')
  }
  if (!stage) return ''
  return stage
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function isFixtureLocked(kickoffUtc: Date, now = new Date()): boolean {
  return kickoffUtc.getTime() <= now.getTime()
}

export function hasResult(homeScore90: number | null, awayScore90: number | null): boolean {
  return homeScore90 !== null && awayScore90 !== null
}
