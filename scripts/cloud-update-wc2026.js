#!/usr/bin/env node

const fetch = globalThis.fetch || require('node-fetch')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient({ log: ['error'] })

const FOOTBALL_DATA_BASE = 'https://api.football-data.org/v4'

function readScoreLine(line) {
  if (!line) return { home: null, away: null }
  return {
    home: line.home ?? line.homeTeam ?? null,
    away: line.away ?? line.awayTeam ?? null,
  }
}

function extractScore90(match) {
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

function mapMatchToFixtureFields(match) {
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
