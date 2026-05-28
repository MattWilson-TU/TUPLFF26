#!/usr/bin/env node

const fetch = globalThis.fetch || require('node-fetch')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient({ log: ['error'] })

const FOOTBALL_DATA_BASE = 'https://api.football-data.org/v4'

function mapMatchToFixtureFields(match) {
  const finished = match.status === 'FINISHED'
  const home = match.score?.fullTime?.home
  const away = match.score?.fullTime?.away
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
    homeScore90: finished && home !== null && away !== null ? home : null,
    awayScore90: finished && home !== null && away !== null ? away : null,
  }
}

async function downloadAndUpdateWc2026Data() {
  const token = process.env.FOOTBALL_DATA_API_TOKEN
  if (!token) {
    throw new Error('FOOTBALL_DATA_API_TOKEN environment variable is required')
  }

  try {
    console.log('🚀 Starting WC2026 data download and update...')

    const res = await fetch(`${FOOTBALL_DATA_BASE}/competitions/WC/matches?season=2026`, {
      headers: { 'X-Auth-Token': token },
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`football-data.org error ${res.status}: ${text}`)
    }

    const data = await res.json()
    const matches = data.matches ?? []
    console.log(`📅 Fetched ${matches.length} WC2026 matches`)

    for (const match of matches) {
      const fields = mapMatchToFixtureFields(match)
      await prisma.wcFixture.upsert({
        where: { id: fields.id },
        update: fields,
        create: fields,
      })
    }

    await prisma.wcDataSync.upsert({
      where: { id: 'singleton' },
      update: { lastSyncedAt: new Date() },
      create: { id: 'singleton', lastSyncedAt: new Date() },
    })

    const totalFixtures = await prisma.wcFixture.count()
    const finishedFixtures = await prisma.wcFixture.count({
      where: { homeScore90: { not: null } },
    })

    console.log('\n✅ WC2026 data update completed!')
    console.log(`📊 Summary:`)
    console.log(`  - Total fixtures: ${totalFixtures}`)
    console.log(`  - With results: ${finishedFixtures}`)
  } catch (error) {
    console.error('❌ Error updating WC2026 data:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

downloadAndUpdateWc2026Data()
