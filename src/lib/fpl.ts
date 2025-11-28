/** FPL API helpers */

export type BootstrapPlayer = {
  id: number
  first_name: string
  second_name: string
  web_name: string
  element_type: number
  now_cost: number
  team: number
  total_points: number
  photo: string
}

export type BootstrapEvent = {
  id: number
  name: string
  is_current: boolean
  is_next: boolean
  is_previous: boolean
  finished: boolean
  data_checked: boolean
}

export async function fetchBootstrap() {
  const res = await fetch('https://fantasy.premierleague.com/api/bootstrap-static/', {
    cache: 'no-store',
  })
  if (!res.ok) throw new Error('Failed to fetch bootstrap')
  return res.json() as Promise<{ elements: BootstrapPlayer[]; events: BootstrapEvent[] }>
}

export async function fetchFinishedEventIds() {
  const data = await fetchBootstrap()
  // Consider an event finished only when both finished and data_checked are true
  return data.events.filter(e => e.finished && e.data_checked).map(e => e.id)
}

export async function fetchFinishedOrCurrentEventIds() {
  const data = await fetchBootstrap()
  const finished = data.events.filter(e => e.finished && e.data_checked).map(e => e.id)
  const current = data.events.find(e => e.is_current)
  const set = new Set<number>(finished)
  if (current) set.add(current.id)
  return Array.from(set).sort((a, b) => a - b)
}

export async function fetchLiveEvent(gw: number) {
  const maxRetries = 3
  let lastError: Error | null = null
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Fetching GW${gw} live data (attempt ${attempt}/${maxRetries})...`)
      
      const res = await fetch(`https://fantasy.premierleague.com/api/event/${gw}/live/`, {
        cache: 'no-store',
        headers: {
          'User-Agent': 'FPL-Auction-App/1.0',
        },
        signal: AbortSignal.timeout(30000), // 30 second timeout
      })
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      }
      
      const data = await res.json()
      console.log(`Successfully fetched GW${gw} data: ${data.elements?.length || 0} players`)
      return data as { elements: { id: number; stats: { total_points: number } }[] }
      
    } catch (error) {
      lastError = error as Error
      console.warn(`Attempt ${attempt} failed for GW${gw}:`, error)
      
      if (attempt < maxRetries) {
        const delay = attempt * 2000 // 2s, 4s delays
        console.log(`Retrying in ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }
  
  throw new Error(`Failed to fetch live event for GW${gw} after ${maxRetries} attempts: ${lastError?.message}`)
}

export function mapElementTypeToPosition(elementType: number) {
  // 1 GK, 2 DEF, 3 MID, 4 FWD
  switch (elementType) {
    case 1:
      return 'GK'
    case 2:
      return 'DEF'
    case 3:
      return 'MID'
    case 4:
      return 'FWD'
    default:
      throw new Error(`Unknown element type: ${elementType}`)
  }
}

export function costToHalfMillion(now_cost: number) {
  // now_cost is in 0.1m increments. Convert to nearest 0.5m
  const inMillions = now_cost / 10 // e.g. 75 => 7.5m
  const halfUnits = Math.round(inMillions / 0.5) // e.g. 7.5/0.5=15
  return halfUnits
}



