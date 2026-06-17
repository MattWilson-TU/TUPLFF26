import assert from 'node:assert/strict'
import { findAnnexCOption, getThirdPlaceAssignments } from './wc2026-annex-c'
import {
  buildGroupTables,
  buildKnockoutProjection,
  rankThirdPlaceTeams,
  type GroupStageFixture,
} from './wc2026-knockout'

function fx(
  id: string,
  group: string,
  home: string,
  away: string,
  homeScore: number,
  awayScore: number
): GroupStageFixture {
  return {
    id,
    homeTeam: home,
    awayTeam: away,
    homeCrest: null,
    awayCrest: null,
    groupName: group,
    homeScore90: homeScore,
    awayScore90: awayScore,
  }
}

// Annex C option 1: groups E,J,I,F,H,G,L,K
assert.equal(findAnnexCOption(new Set(['E', 'J', 'I', 'F', 'H', 'G', 'L', 'K'])), 1)
assert.deepEqual(getThirdPlaceAssignments(1), {
  '1A': 'E',
  '1B': 'J',
  '1D': 'I',
  '1E': 'F',
  '1G': 'H',
  '1I': 'G',
  '1K': 'L',
  '1L': 'K',
})

// Group A: T1 9pts, T2 6pts, T3 3pts
const groupA = buildGroupTables([
  fx('1', 'GROUP_A', 'T1', 'T2', 2, 1),
  fx('2', 'GROUP_A', 'T3', 'T4', 1, 0),
  fx('3', 'GROUP_A', 'T1', 'T3', 3, 0),
  fx('4', 'GROUP_A', 'T4', 'T2', 0, 2),
  fx('5', 'GROUP_A', 'T1', 'T4', 1, 0),
  fx('6', 'GROUP_A', 'T2', 'T3', 2, 1),
])
const tableA = groupA.find((g) => g.group === 'A')!
assert.equal(tableA.complete, true)
assert.equal(tableA.teams[0].team, 'T1')
assert.equal(tableA.teams[2].team, 'T3')

// H2H tiebreaker: T1 beats T2 on 4 pts each
const groupB = buildGroupTables([
  fx('1', 'GROUP_B', 'T1', 'T2', 2, 1),
  fx('2', 'GROUP_B', 'T3', 'T4', 1, 0),
  fx('3', 'GROUP_B', 'T1', 'T3', 0, 3),
  fx('4', 'GROUP_B', 'T4', 'T2', 0, 3),
  fx('5', 'GROUP_B', 'T1', 'T4', 0, 0),
  fx('6', 'GROUP_B', 'T2', 'T3', 0, 0),
])
const tableB = groupB.find((g) => g.group === 'B')!
assert.equal(tableB.teams[0].team, 'T3')
assert.equal(tableB.teams[1].team, 'T1')

const thirdRank = rankThirdPlaceTeams([...groupA, ...groupB].length === 24 ? [...groupA, ...groupB] : groupA.concat(groupB))
assert.equal(thirdRank.find((e) => e.group === 'B')!.rank, 1)

function mockGroup(letter: string, teams: readonly [string, string, string, string]): GroupStageFixture[] {
  const [w, r2, r3, r4] = teams
  const g = `GROUP_${letter}`
  return [
    fx(`${letter}1`, g, w, r2, 2, 0),
    fx(`${letter}2`, g, r3, r4, 1, 0),
    fx(`${letter}3`, g, w, r3, 2, 0),
    fx(`${letter}4`, g, r4, r2, 0, 1),
    fx(`${letter}5`, g, w, r4, 3, 0),
    fx(`${letter}6`, g, r2, r3, 2, 1),
  ]
}

const fullFixtures: GroupStageFixture[] = []
for (const [letter, teams] of [
  ['A', ['A1', 'A2', 'A3', 'A4']],
  ['B', ['B1', 'B2', 'B3', 'B4']],
  ['C', ['C1', 'C2', 'C3', 'C4']],
  ['D', ['D1', 'D2', 'D3', 'D4']],
  ['E', ['E1', 'E2', 'E3', 'E4']],
  ['F', ['F1', 'F2', 'F3', 'F4']],
  ['G', ['G1', 'G2', 'G3', 'G4']],
  ['H', ['H1', 'H2', 'H3', 'H4']],
  ['I', ['I1', 'I2', 'I3', 'I4']],
  ['J', ['J1', 'J2', 'J3', 'J4']],
  ['K', ['K1', 'K2', 'K3', 'K4']],
  ['L', ['L1', 'L2', 'L3', 'L4']],
] as const) {
  fullFixtures.push(...mockGroup(letter, teams))
}

const projection = buildKnockoutProjection(fullFixtures)
assert.equal(projection.groupStageComplete, true)
assert.equal(projection.roundOf32.length, 16)
assert.equal(projection.roundOf32[0].home.name, 'A2')
assert.ok(projection.annexCOption)

console.log('All wc2026 knockout tests passed.')
