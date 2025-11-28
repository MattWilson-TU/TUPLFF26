'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
// removed avatar/photo usage per request

interface Player {
  id: number
  firstName: string
  secondName: string
  webName?: string
  elementType: 'GK' | 'DEF' | 'MID' | 'FWD'
  nowCostHalfM: number
  teamId: number
  team?: { id: number; name: string; shortName?: string }
  totalPoints: number
  photo: string
  currentOwner?: {
    id: string
    username: string
  }
  auctionLots?: Array<{
    soldPriceHalfM: number
    winner: {
      id: string
      username: string
    } | null
  }>
}

export default function PlayersPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [players, setPlayers] = useState<Player[]>([])
  const [filteredPlayers, setFilteredPlayers] = useState<Player[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [positionFilter, setPositionFilter] = useState<string>('all')
  const [ownerFilter, setOwnerFilter] = useState<string>('all')
  const [minPrice, setMinPrice] = useState<string>('')
  const [maxPrice, setMaxPrice] = useState<string>('')
  const [minPoints, setMinPoints] = useState<string>('')
  const [maxPoints, setMaxPoints] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [sortKey, setSortKey] = useState<'name' | 'position' | 'price' | 'points' | 'owner' | 'team'>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
    }
  }, [status, router])

  useEffect(() => {
    fetchPlayers()
  }, [])

  useEffect(() => {
    filterPlayers()
  }, [players, searchTerm, positionFilter, ownerFilter, sortKey, sortDir])

  const fetchPlayers = async () => {
    try {
      const params = new URLSearchParams()
      if (minPrice) params.set('minPrice', minPrice)
      if (maxPrice) params.set('maxPrice', maxPrice)
      if (minPoints) params.set('minPoints', minPoints)
      if (maxPoints) params.set('maxPoints', maxPoints)
      if (ownerFilter !== 'all') params.set('owner', ownerFilter)
      const response = await fetch(`/api/players?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        setPlayers(data)
      }
    } catch (error) {
      console.error('Error fetching players:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const filterPlayers = () => {
    let filtered = players

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(player => {
        const fullName = `${player.firstName} ${player.secondName}`.toLowerCase()
        const webName = player.webName?.toLowerCase() || ''
        const teamName = player.team?.name?.toLowerCase() || ''
        const teamShortName = player.team?.shortName?.toLowerCase() || ''
        const searchLower = searchTerm.toLowerCase()
        return fullName.includes(searchLower) || 
               webName.includes(searchLower) || 
               teamName.includes(searchLower) || 
               teamShortName.includes(searchLower)
      })
    }

    // Filter by position
    if (positionFilter !== 'all') {
      filtered = filtered.filter(player => player.elementType === positionFilter)
    }

    // Filter by owner status
    if (ownerFilter === 'owned') {
      filtered = filtered.filter(player => player.currentOwner !== null)
    } else if (ownerFilter === 'unowned') {
      filtered = filtered.filter(player => player.currentOwner === null)
    }

    // Sorting
    const compare = (a: Player, b: Player) => {
      const dir = sortDir === 'asc' ? 1 : -1
      switch (sortKey) {
        case 'name': {
          const an = (a.webName || `${a.firstName} ${a.secondName}`).toLowerCase()
          const bn = (b.webName || `${b.firstName} ${b.secondName}`).toLowerCase()
          return an < bn ? -1 * dir : an > bn ? 1 * dir : 0
        }
        case 'position':
          return (a.elementType as string).localeCompare(b.elementType as string) * dir
        case 'price':
          return (a.nowCostHalfM - b.nowCostHalfM) * dir
        case 'points':
          return (a.totalPoints - b.totalPoints) * dir
        case 'owner': {
          const ao = a.currentOwner?.username || ''
          const bo = b.currentOwner?.username || ''
          return ao.localeCompare(bo) * dir
        }
        case 'team': {
          const at = (a as any).team?.name || ''
          const bt = (b as any).team?.name || ''
          return at.localeCompare(bt) * dir
        }
        default:
          return 0
      }
    }
    setFilteredPlayers([...filtered].sort(compare))
  }

  const getPositionColor = (position: string) => {
    switch (position) {
      case 'GK': return 'bg-green-100 text-green-800'
      case 'DEF': return 'bg-blue-100 text-blue-800'
      case 'MID': return 'bg-yellow-100 text-yellow-800'
      case 'FWD': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const formatPrice = (halfMillionUnits: number) => {
    return `£${(halfMillionUnits * 0.5).toFixed(1)}m`
  }

  const handleSort = (key: typeof sortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const arrowFor = (key: typeof sortKey) => {
    if (sortKey !== key) return ''
    return sortDir === 'asc' ? '↑' : '↓'
  }

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading players...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Player Database</h1>
          <p className="text-gray-600 mt-2">
            Search and analyze all available players
          </p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Search & Filter</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Search players by name or team..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={positionFilter === 'all' ? 'default' : 'outline'}
                  onClick={() => setPositionFilter('all')}
                >
                  All
                </Button>
                <Button
                  variant={positionFilter === 'GK' ? 'default' : 'outline'}
                  onClick={() => setPositionFilter('GK')}
                >
                  GK
                </Button>
                <Button
                  variant={positionFilter === 'DEF' ? 'default' : 'outline'}
                  onClick={() => setPositionFilter('DEF')}
                >
                  DEF
                </Button>
                <Button
                  variant={positionFilter === 'MID' ? 'default' : 'outline'}
                  onClick={() => setPositionFilter('MID')}
                >
                  MID
                </Button>
                <Button
                  variant={positionFilter === 'FWD' ? 'default' : 'outline'}
                  onClick={() => setPositionFilter('FWD')}
                >
                  FWD
                </Button>
                <Button
                  variant={ownerFilter === 'all' ? 'default' : 'outline'}
                  onClick={() => setOwnerFilter('all')}
                >
                  All Owners
                </Button>
                <Button
                  variant={ownerFilter === 'owned' ? 'default' : 'outline'}
                  onClick={() => setOwnerFilter('owned')}
                >
                  Owned
                </Button>
                <Button
                  variant={ownerFilter === 'unowned' ? 'default' : 'outline'}
                  onClick={() => setOwnerFilter('unowned')}
                >
                  Unowned
                </Button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Input placeholder="Min £m" type="number" step="0.5" value={minPrice} onChange={e => setMinPrice(e.target.value)} />
                <Input placeholder="Max £m" type="number" step="0.5" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} />
                <Input placeholder="Min pts" type="number" value={minPoints} onChange={e => setMinPoints(e.target.value)} />
                <Input placeholder="Max pts" type="number" value={maxPoints} onChange={e => setMaxPoints(e.target.value)} />
              </div>
              <div>
                <Button onClick={fetchPlayers}>Apply Filters</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              Players ({filteredPlayers.length} of {players.length})
            </CardTitle>
            <CardDescription>
              Click on a player to view detailed statistics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <button className="underline" onClick={() => handleSort('name')}>Player {arrowFor('name')}</button>
                  </TableHead>
                  <TableHead>
                    <button className="underline" onClick={() => handleSort('position')}>Position {arrowFor('position')}</button>
                  </TableHead>
                  <TableHead>
                    <button className="underline" onClick={() => handleSort('team')}>Team {arrowFor('team')}</button>
                  </TableHead>
                  <TableHead>
                    <button className="underline" onClick={() => handleSort('price')}>Price {arrowFor('price')}</button>
                  </TableHead>
                  <TableHead>
                    <button className="underline" onClick={() => handleSort('points')}>Total Points {arrowFor('points')}</button>
                  </TableHead>
                  <TableHead>
                    <button className="underline" onClick={() => handleSort('owner')}>Current Owner {arrowFor('owner')}</button>
                  </TableHead>
                  <TableHead>Auction Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPlayers.map((player) => (
                  <TableRow key={player.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{player.webName || `${player.firstName} ${player.secondName}`}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getPositionColor(player.elementType)}>
                        {player.elementType}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-gray-700">{(player as any).team?.name || `Team ${player.teamId}`}</span>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{formatPrice(player.nowCostHalfM)}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-blue-600 font-medium">{player.totalPoints}</span>
                    </TableCell>
                    <TableCell>
                      {player.currentOwner ? (
                        <Badge variant="secondary">{player.currentOwner.username}</Badge>
                      ) : (
                        <Badge variant="outline">Available</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {player.auctionLots && player.auctionLots.length > 0 && player.auctionLots[0] ? (
                        <span className="font-medium text-green-600">
                          {formatPrice(player.auctionLots[0].soldPriceHalfM)}
                        </span>
                      ) : (
                        <span className="text-gray-400">Not sold</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
