#!/usr/bin/env node

// Use built-in fetch for Node.js 18+
const fetch = globalThis.fetch || require('node-fetch')

async function checkAvailableGameweeks() {
  try {
    console.log('🔍 Checking available FPL gameweeks...')
    
    const bootstrapRes = await fetch('https://fantasy.premierleague.com/api/bootstrap-static/')
    if (!bootstrapRes.ok) {
      throw new Error(`Failed to fetch bootstrap: ${bootstrapRes.status}`)
    }
    
    const bootstrap = await bootstrapRes.json()
    
    const events = bootstrap.events
      .filter(event => event.finished || event.is_current)
      .sort((a, b) => a.id - b.id)
    
    console.log(`\n📅 Available gameweeks (${events.length} total):`)
    console.log('┌─────────────┬─────────────┬─────────────┬─────────────┬─────────────┐')
    console.log('│ Gameweek    │ Status      │ Phase       │ Data Checked│ Name        │')
    console.log('├─────────────┼─────────────┼─────────────┼─────────────┼─────────────┤')
    
    for (const event of events) {
      const phase = event.id <= 11 ? 1 : event.id <= 26 ? 2 : event.id <= 31 ? 3 : 4
      const status = event.is_current ? 'CURRENT' : event.finished ? 'FINISHED' : 'UNKNOWN'
      const dataChecked = event.data_checked ? '✅' : '❌'
      const name = event.name || `GW${event.id}`
      
      console.log(`│ GW${event.id.toString().padEnd(10)} │ ${status.padEnd(11)} │ Phase ${phase}     │ ${dataChecked.padEnd(11)} │ ${name.padEnd(11)} │`)
    }
    
    console.log('└─────────────┴─────────────┴─────────────┴─────────────┴─────────────┘')
    
    const finishedCount = events.filter(e => e.finished && e.data_checked).length
    const currentCount = events.filter(e => e.is_current).length
    
    console.log(`\n📊 Summary:`)
    console.log(`  - Finished & data checked: ${finishedCount}`)
    console.log(`  - Current: ${currentCount}`)
    console.log(`  - Total available: ${events.length}`)
    
    if (events.length > 0) {
      const latest = events[events.length - 1]
      console.log(`  - Latest: GW${latest.id} (${latest.name || 'Unknown'})`)
    }
    
  } catch (error) {
    console.error('❌ Error checking gameweeks:', error.message)
    process.exit(1)
  }
}

checkAvailableGameweeks()
