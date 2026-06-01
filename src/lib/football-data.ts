const FOOTBALL_DATA_BASE = 'https://api.football-data.org/v4'

type FootballDataScoreLine = {
  home?: number | null
  away?: number | null
  homeTeam?: number | null
  awayTeam?: number | null
} | null

export interface FootballDataMatch {
  id: number
  utcDate: string
  status: string
  stage: string | null
  group: string | null
  matchday: number | null
  homeTeam: { name: string; shortName?: string; crest: string | null }
  awayTeam: { name: string; shortName?: string; crest: string | null }
  score?: {
    duration?: string | null
    fullTime?: FootballDataScoreLine
    regularTime?: FootballDataScoreLine
  } | null
}

function readScoreLine(line: FootballDataScoreLine): { home: number | null; away: number | null } {
  if (!line) return { home: null, away: null }
  const home = line.home ?? line.homeTeam ?? null
  const away = line.away ?? line.awayTeam ?? null
  return { home, away }
}

export function extractScore90(match: FootballDataMatch): { home: number | null; away: number | null } {
  if (match.status !== 'FINISHED') {
    return { home: null, away: null }
  }

  const regular = readScoreLine(match.score?.regularTime)
  if (regular.home !== null && regular.away !== null) {
    return regular
  }

  const full = readScoreLine(match.score?.fullTime)
  if (full.home !== null && full.away !== null) {
    return full
  }

  return { home: null, away: null }
}

export interface FootballDataMatchesResponse {
  matches: FootballDataMatch[]
}

export async function fetchWorldCup2026Matches(token: string): Promise<FootballDataMatch[]> {
  const res = await fetch(`${FOOTBALL_DATA_BASE}/competitions/WC/matches?season=2026`, {
    headers: { 'X-Auth-Token': token },
    next: { revalidate: 0 },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`football-data.org error ${res.status}: ${text}`)
  }

  const data: FootballDataMatchesResponse = await res.json()
  return data.matches ?? []
}

export function mapMatchToFixtureFields(match: FootballDataMatch) {
  const { home, away } = extractScore90(match)
  const homeTeamName = match.homeTeam?.name || match.homeTeam?.shortName || 'TBD'
  const awayTeamName = match.awayTeam?.name || match.awayTeam?.shortName || 'TBD'

  return {
    id: String(match.id),
    homeTeam: homeTeamName,
    awayTeam: awayTeamName,
    homeCrest: match.homeTeam?.crest ?? null,
    awayCrest: match.awayTeam?.crest ?? null,
    kickoffUtc: new Date(match.utcDate),
    stage: match.stage,
    groupName: match.group,
    matchday: match.matchday,
    status: match.status,
    homeScore90: home,
    awayScore90: away,
  }
}
