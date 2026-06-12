export function scorePrediction(
  pred: { home: number; away: number },
  result: { home: number; away: number }
): number {
  if (pred.home === result.home && pred.away === result.away) return 3
  const predOutcome = Math.sign(pred.home - pred.away)
  const actualOutcome = Math.sign(result.home - result.away)
  return predOutcome === actualOutcome ? 1 : 0
}

export function computeFixturePoints(
  prediction: { homeScore: number; awayScore: number } | null | undefined,
  fixture: {
    kickoffUtc: Date
    homeScore90: number | null
    awayScore90: number | null
  },
  now = new Date()
): number | null {
  const locked = isFixtureLocked(fixture.kickoffUtc, now)
  const finished = hasResult(fixture.homeScore90, fixture.awayScore90)

  if (!prediction && locked) {
    return 0
  }

  if (
    prediction &&
    finished &&
    fixture.homeScore90 !== null &&
    fixture.awayScore90 !== null
  ) {
    return scorePrediction(
      { home: prediction.homeScore, away: prediction.awayScore },
      { home: fixture.homeScore90, away: fixture.awayScore90 }
    )
  }

  return null
}

export function computeManagerPoints(
  predictions: Array<{ fixtureId: string; homeScore: number; awayScore: number }>,
  finishedFixtures: Array<{
    id: string
    kickoffUtc: Date
    homeScore90: number | null
    awayScore90: number | null
  }>,
  now = new Date()
): number {
  const predictionByFixture = new Map(predictions.map((p) => [p.fixtureId, p]))
  let totalPoints = 0

  for (const fixture of finishedFixtures) {
    const points = computeFixturePoints(predictionByFixture.get(fixture.id), fixture, now)
    if (points !== null) {
      totalPoints += points
    }
  }

  return totalPoints
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

const LIVE_STATUSES = new Set(['IN_PLAY', 'PAUSED', 'LIVE'])

export function isFixtureInProgress(
  fixture: {
    status: string
    kickoffUtc: Date
    homeScore90: number | null
    awayScore90: number | null
  },
  now = new Date()
): boolean {
  if (hasResult(fixture.homeScore90, fixture.awayScore90)) return false
  if (LIVE_STATUSES.has(fixture.status)) return true
  return isFixtureLocked(fixture.kickoffUtc, now)
}
