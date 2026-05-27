const FOOTBALL_DATA_BASE = 'https://api.football-data.org/v4'

export interface FootballDataMatch {
  id: number
  utcDate: string
  status: string
  stage: string | null
  group: string | null
  matchday: number | null
  homeTeam: { name: string; crest: string | null }
  awayTeam: { name: string; crest: string | null }
  score: {
    fullTime: { home: number | null; away: number | null }
  }
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
  const finished = match.status === 'FINISHED'
  const home = match.score?.fullTime?.home
  const away = match.score?.fullTime?.away

  return {
    id: String(match.id),
    homeTeam: match.homeTeam.name,
    awayTeam: match.awayTeam.name,
    homeCrest: match.homeTeam.crest,
    awayCrest: match.awayTeam.crest,
    kickoffUtc: new Date(match.utcDate),
    stage: match.stage,
    groupName: match.group,
    matchday: match.matchday,
    status: match.status,
    homeScore90: finished && home !== null && away !== null ? home : null,
    awayScore90: finished && home !== null && away !== null ? away : null,
  }
}
