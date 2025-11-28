const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args))

async function testAPIs() {
  const baseUrl = 'https://web-app-884572147716.europe-west2.run.app'
  
  try {
    console.log('🧪 Testing APIs...')
    
    // Test managers API
    console.log('\n📊 Testing managers API...')
    const managersRes = await fetch(`${baseUrl}/api/managers`)
    if (managersRes.ok) {
      const managers = await managersRes.json()
      console.log(`✅ Managers API: ${managers.length} managers found`)
      console.log(`   First manager: ${managers[0].username} (${managers[0].name})`)
      console.log(`   Total points: ${managers[0].computedTotalPoints}`)
    } else {
      console.log(`❌ Managers API failed: ${managersRes.status}`)
    }
    
    // Test players API
    console.log('\n⚽ Testing players API...')
    const playersRes = await fetch(`${baseUrl}/api/players`)
    if (playersRes.ok) {
      const players = await playersRes.json()
      console.log(`✅ Players API: ${players.length} players found`)
      const ownedPlayers = players.filter(p => p.currentOwner)
      console.log(`   Owned players: ${ownedPlayers.length}`)
    } else {
      console.log(`❌ Players API failed: ${playersRes.status}`)
    }
    
    // Test auction current API
    console.log('\n🎯 Testing auction current API...')
    const auctionRes = await fetch(`${baseUrl}/api/auction/current`)
    if (auctionRes.ok) {
      const auction = await auctionRes.json()
      console.log(`✅ Auction API: Status = ${auction.status}`)
    } else {
      console.log(`❌ Auction API failed: ${auctionRes.status}`)
    }
    
    // Test stats APIs
    console.log('\n📈 Testing stats APIs...')
    const topPlayersRes = await fetch(`${baseUrl}/api/stats/top-players`)
    if (topPlayersRes.ok) {
      const topPlayers = await topPlayersRes.json()
      console.log(`✅ Top players API: Working`)
      console.log(`   GK: ${topPlayers.GK?.length || 0} players`)
      console.log(`   DEF: ${topPlayers.DEF?.length || 0} players`)
      console.log(`   MID: ${topPlayers.MID?.length || 0} players`)
      console.log(`   FWD: ${topPlayers.FWD?.length || 0} players`)
    } else {
      console.log(`❌ Top players API failed: ${topPlayersRes.status}`)
    }
    
    const managerPerfRes = await fetch(`${baseUrl}/api/stats/manager-performance`)
    if (managerPerfRes.ok) {
      const managerPerf = await managerPerfRes.json()
      console.log(`✅ Manager performance API: ${managerPerf.length} managers`)
    } else {
      console.log(`❌ Manager performance API failed: ${managerPerfRes.status}`)
    }
    
    console.log('\n🎉 API testing completed!')
    
  } catch (error) {
    console.error('❌ Error testing APIs:', error.message)
  }
}

testAPIs()
