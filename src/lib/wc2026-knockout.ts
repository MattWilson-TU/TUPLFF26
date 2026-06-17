import {
  findAnnexCOption,
  getThirdPlaceAssignments,
  type GroupLetter,
  type ThirdPlaceSlot,
} from './wc2026-annex-c'
import { hasResult } from './wc2026-scoring'

export type { GroupLetter }

export const GROUP_LETTERS: GroupLetter[] = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L',
]

export interface GroupStageFixture {
  id: string
  homeTeam: string
  awayTeam: string
  homeCrest: string | null
  awayCrest: string | null
  groupName: string | null
  homeScore90: number | null
  awayScore90: number | null
}

export interface GroupStanding {
  team: string
  crest: string | null
  played: number
  w: number
  d: number
  l: number
  gf: number
  ga: number
  gd: number
  pts: number
  position?: 1 | 2 | 3 | 4
  tied?: boolean
}

export interface GroupTable {
  group: GroupLetter
  complete: boolean
  playedMatches: number
  totalMatches: number
  teams: GroupStanding[]
}

export interface ThirdPlaceEntry {
  group: GroupLetter
  team: string
  crest: string | null
  played: number
  pts: number
  gd: number
  gf: number
  rank?: number
  qualified?: boolean
  tied?: boolean
}

export interface BracketTeam {
  name: string
  crest: string | null
  slot: string
}

export interface RoundOf32Match {
  matchNo: number
  home: BracketTeam
  away: BracketTeam
  provisional: boolean
}

export interface KnockoutProjection {
  groupStageComplete: boolean
  provisional: boolean
  hasUnresolvedTies: boolean
  annexCOption: number | null
  groups: GroupTable[]
  thirdPlaceRanking: ThirdPlaceEntry[]
  roundOf32: RoundOf32Match[]
}

type FinishedFixture = GroupStageFixture & { homeScore90: number; awayScore90: number }

interface TeamStats {
  team: string
  crest: string | null
  played: number
  w: number
  d: number
  l: number
  gf: number
  ga: number
  gd: number
  pts: number
}

const ROUND_OF_32_TEMPLATE: Array<{
  matchNo: number
  home: string
  away: string | { thirdPlaceSlot: ThirdPlaceSlot }
}> = [
  { matchNo: 73, home: '2A', away: '2B' },
  { matchNo: 74, home: '1E', away: { thirdPlaceSlot: '1E' } },
  { matchNo: 75, home: '1F', away: '2C' },
  { matchNo: 76, home: '1C', away: '2F' },
  { matchNo: 77, home: '1I', away: { thirdPlaceSlot: '1I' } },
  { matchNo: 78, home: '2E', away: '2I' },
  { matchNo: 79, home: '1A', away: { thirdPlaceSlot: '1A' } },
  { matchNo: 80, home: '1L', away: { thirdPlaceSlot: '1L' } },
  { matchNo: 81, home: '1D', away: { thirdPlaceSlot: '1D' } },
  { matchNo: 82, home: '1G', away: { thirdPlaceSlot: '1G' } },
  { matchNo: 83, home: '2K', away: '2L' },
  { matchNo: 84, home: '1H', away: '2J' },
  { matchNo: 85, home: '1B', away: { thirdPlaceSlot: '1B' } },
  { matchNo: 86, home: '1J', away: '2H' },
  { matchNo: 87, home: '1K', away: { thirdPlaceSlot: '1K' } },
  { matchNo: 88, home: '2D', away: '2G' },
]

function parseGroupLetter(groupName: string | null | undefined): GroupLetter | null {
  if (!groupName) return null
  const match = groupName.match(/GROUP[_\s]?([A-L])/i)
  return match ? (match[1].toUpperCase() as GroupLetter) : null
}

function isFinished(f: GroupStageFixture): f is FinishedFixture {
  return hasResult(f.homeScore90, f.awayScore90)
}

function emptyStats(team: string, crest: string | null): TeamStats {
  return { team, crest, played: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0 }
}

function applyResult(stats: TeamStats, gf: number, ga: number): TeamStats {
  const played = stats.played + 1
  const ngf = stats.gf + gf
  const nga = stats.ga + ga
  if (gf > ga) {
    return { ...stats, played, w: stats.w + 1, gf: ngf, ga: nga, gd: ngf - nga, pts: stats.pts + 3 }
  }
  if (gf < ga) {
    return { ...stats, played, l: stats.l + 1, gf: ngf, ga: nga, gd: ngf - nga }
  }
  return { ...stats, played, d: stats.d + 1, gf: ngf, ga: nga, gd: ngf - nga, pts: stats.pts + 1 }
}

function computeStats(
  teamNames: Set<string>,
  fixtures: FinishedFixture[]
): Map<string, TeamStats> {
  const stats = new Map<string, TeamStats>()
  for (const name of teamNames) stats.set(name, emptyStats(name, null))
  for (const f of fixtures) {
    if (!teamNames.has(f.homeTeam) || !teamNames.has(f.awayTeam)) continue
    stats.set(f.homeTeam, applyResult(stats.get(f.homeTeam)!, f.homeScore90, f.awayScore90))
    stats.set(f.awayTeam, applyResult(stats.get(f.awayTeam)!, f.awayScore90, f.homeScore90))
  }
  return stats
}

function compareByKeys(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const av = a[i] ?? 0
    const bv = b[i] ?? 0
    if (av !== bv) return bv - av
  }
  return 0
}

function splitByEqualKeys<T>(items: T[], keyFn: (item: T) => number[]): T[][] {
  if (items.length === 0) return []
  const groups: T[][] = []
  let current: T[] = [items[0]]
  let currentKey = keyFn(items[0])
  for (let i = 1; i < items.length; i++) {
    const key = keyFn(items[i])
    if (compareByKeys(key, currentKey) === 0) current.push(items[i])
    else {
      groups.push(current)
      current = [items[i]]
      currentKey = key
    }
  }
  groups.push(current)
  return groups
}

function resolveTiedTeams(
  tied: TeamStats[],
  fixtures: FinishedFixture[]
): Array<TeamStats & { tied?: boolean }> {
  if (tied.length <= 1) return tied
  const tiedNames = new Set(tied.map((t) => t.team))
  const h2hFixtures = fixtures.filter(
    (f) => tiedNames.has(f.homeTeam) && tiedNames.has(f.awayTeam)
  )
  const h2hStats = computeStats(tiedNames, h2hFixtures)
  const step1Sorted = [...tied].sort((a, b) =>
    compareByKeys(
      [h2hStats.get(a.team)!.pts, h2hStats.get(a.team)!.gd, h2hStats.get(a.team)!.gf],
      [h2hStats.get(b.team)!.pts, h2hStats.get(b.team)!.gd, h2hStats.get(b.team)!.gf]
    )
  )
  const step1Groups = splitByEqualKeys(step1Sorted, (t) => [
    h2hStats.get(t.team)!.pts,
    h2hStats.get(t.team)!.gd,
    h2hStats.get(t.team)!.gf,
  ])
  const result: Array<TeamStats & { tied?: boolean }> = []
  for (const group of step1Groups) {
    if (group.length === 1) {
      result.push(group[0])
      continue
    }
    const step2Sorted = [...group].sort((a, b) => compareByKeys([a.gd, a.gf], [b.gd, b.gf]))
    const step2Groups = splitByEqualKeys(step2Sorted, (t) => [t.gd, t.gf])
    for (const g2 of step2Groups) {
      if (g2.length === 1) result.push(g2[0])
      else for (const t of g2) result.push({ ...t, tied: true })
    }
  }
  return result
}

function rankGroupTeams(
  teams: TeamStats[],
  fixtures: FinishedFixture[]
): Array<TeamStats & { tied?: boolean }> {
  const remaining = [...teams]
  const ranked: Array<TeamStats & { tied?: boolean }> = []
  while (remaining.length > 0) {
    const maxPts = Math.max(...remaining.map((t) => t.pts))
    const tied = remaining.filter((t) => t.pts === maxPts)
    const resolved = resolveTiedTeams(tied, fixtures)
    ranked.push(...resolved)
    const resolvedNames = new Set(resolved.map((t) => t.team))
    for (let i = remaining.length - 1; i >= 0; i--) {
      if (resolvedNames.has(remaining[i].team)) remaining.splice(i, 1)
    }
  }
  return ranked
}

export function buildGroupTables(fixtures: GroupStageFixture[]): GroupTable[] {
  const groupFixtures = new Map<GroupLetter, GroupStageFixture[]>()
  const crestByTeam = new Map<string, string | null>()

  for (const f of fixtures) {
    const group = parseGroupLetter(f.groupName)
    if (!group) continue
    if (!groupFixtures.has(group)) groupFixtures.set(group, [])
    groupFixtures.get(group)!.push(f)
    if (f.homeCrest) crestByTeam.set(f.homeTeam, f.homeCrest)
    if (f.awayCrest) crestByTeam.set(f.awayTeam, f.awayCrest)
  }

  return GROUP_LETTERS.map((group) => {
    const gFixtures = groupFixtures.get(group) ?? []
    const finished = gFixtures.filter(isFinished)
    const teamNames = new Set<string>()
    for (const f of gFixtures) {
      teamNames.add(f.homeTeam)
      teamNames.add(f.awayTeam)
    }
    const statsMap = computeStats(teamNames, finished)
    const teams = [...teamNames].map((team) => ({
      ...(statsMap.get(team) ?? emptyStats(team, crestByTeam.get(team) ?? null)),
      crest: crestByTeam.get(team) ?? null,
    }))
    const ranked = rankGroupTeams(teams, finished)
    return {
      group,
      complete: gFixtures.length > 0 && finished.length === gFixtures.length,
      playedMatches: finished.length,
      totalMatches: gFixtures.length > 0 ? gFixtures.length : 6,
      teams: ranked.map((t, i) => ({ ...t, position: (i + 1) as 1 | 2 | 3 | 4 })),
    }
  })
}

function rankThirdPlaceList(entries: ThirdPlaceEntry[]): ThirdPlaceEntry[] {
  const sorted = [...entries].sort((a, b) => compareByKeys([a.pts, a.gd, a.gf], [b.pts, b.gd, b.gf]))
  const groups = splitByEqualKeys(sorted, (e) => [e.pts, e.gd, e.gf])
  const result: ThirdPlaceEntry[] = []
  let rank = 1
  for (const group of groups) {
    for (const entry of group) {
      result.push({ ...entry, rank, qualified: rank <= 8, tied: group.length > 1 })
      rank++
    }
  }
  return result
}

export function rankThirdPlaceTeams(tables: GroupTable[]): ThirdPlaceEntry[] {
  const entries: ThirdPlaceEntry[] = []
  for (const table of tables) {
    const third = table.teams.find((t) => t.position === 3)
    if (!third) continue
    entries.push({
      group: table.group,
      team: third.team,
      crest: third.crest,
      played: third.played,
      pts: third.pts,
      gd: third.gd,
      gf: third.gf,
      tied: third.tied,
    })
  }
  return rankThirdPlaceList(entries)
}

function getTeamBySlot(
  tables: GroupTable[],
  slot: string
): { team: string; crest: string | null } | null {
  const match = slot.match(/^([12])([A-L])$/)
  if (!match) return null
  const position = parseInt(match[1], 10) as 1 | 2 | 3 | 4
  const group = match[2] as GroupLetter
  const standing = tables.find((t) => t.group === group)?.teams.find((t) => t.position === position)
  return standing ? { team: standing.team, crest: standing.crest } : null
}

function getThirdByGroup(
  tables: GroupTable[],
  group: GroupLetter
): { team: string; crest: string | null } | null {
  const third = tables.find((t) => t.group === group)?.teams.find((t) => t.position === 3)
  return third ? { team: third.team, crest: third.crest } : null
}

function unknownTeam(slot: string): BracketTeam {
  return { name: 'TBD', crest: null, slot }
}

function resolveFixedSlot(tables: GroupTable[], slot: string): BracketTeam {
  const team = getTeamBySlot(tables, slot)
  return team ? { name: team.team, crest: team.crest, slot } : unknownTeam(slot)
}

function resolveThirdSlot(
  tables: GroupTable[],
  slot: ThirdPlaceSlot,
  assignments: Record<ThirdPlaceSlot, GroupLetter> | null,
  qualified: Set<GroupLetter>
): BracketTeam {
  if (!assignments) return unknownTeam(`3?→${slot}`)
  const group = assignments[slot]
  if (!qualified.has(group)) return unknownTeam(`3${group}`)
  const team = getThirdByGroup(tables, group)
  return team ? { name: team.team, crest: team.crest, slot: `3${group}` } : unknownTeam(`3${group}`)
}

export function buildKnockoutProjection(fixtures: GroupStageFixture[]): KnockoutProjection {
  const groups = buildGroupTables(fixtures)
  const thirdPlaceRanking = rankThirdPlaceTeams(groups)
  const groupStageComplete = groups.every((g) => g.complete && g.teams.length === 4)
  const hasUnresolvedTies =
    groups.some((g) => g.teams.some((t) => t.tied)) || thirdPlaceRanking.some((e) => e.tied)

  const qualifiedGroups = new Set(
    thirdPlaceRanking.filter((e) => e.qualified).map((e) => e.group)
  )
  const annexCOption = findAnnexCOption(qualifiedGroups)
  const assignments = annexCOption ? getThirdPlaceAssignments(annexCOption) : null

  const roundOf32: RoundOf32Match[] = ROUND_OF_32_TEMPLATE.map(({ matchNo, home, away }) => ({
    matchNo,
    home: resolveFixedSlot(groups, home),
    away:
      typeof away === 'string'
        ? resolveFixedSlot(groups, away)
        : resolveThirdSlot(groups, away.thirdPlaceSlot, assignments, qualifiedGroups),
    provisional: !groupStageComplete,
  }))

  return {
    groupStageComplete,
    provisional: !groupStageComplete,
    hasUnresolvedTies,
    annexCOption,
    groups,
    thirdPlaceRanking,
    roundOf32,
  }
}
