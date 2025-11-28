'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface Player {
  id: number
  firstName: string
  secondName: string
  elementType: 'GK' | 'DEF' | 'MID' | 'FWD'
  nowCostHalfM: number
  team: { name: string }
  // Optional webname derived from FPL
  webName?: string
}

interface Bid {
  id: string
  amountHalfM: number
  manager: {
    id: string
    name: string
    username: string
  }
  createdAt: string
}

interface AuctionLot {
  id: string
  player: Player
  isSold: boolean
  soldPriceHalfM?: number
  winnerId?: string
  winner?: {
    id: string
    name: string
    username: string
  }
  bids: Bid[]
}

interface Auction {
  id: string
  status: string
  phase: number
  lots: AuctionLot[]
}

interface Manager {
  id: string
  name: string
  username: string
  budgetKGBP: number
}

export default function AuctionRoomPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [auction, setAuction] = useState<Auction | null>(null)
  const [currentLot, setCurrentLot] = useState<AuctionLot | null>(null)
  const [currentIndex, setCurrentIndex] = useState(-1)
  const [managers, setManagers] = useState<Manager[]>([])
  const [selectedManager, setSelectedManager] = useState('')
  const [customPrice, setCustomPrice] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [positionFilter, setPositionFilter] = useState<string>('ALL')
  const auctionStatusRef = useRef<string>('OPEN')
  const [selectedLotId, setSelectedLotId] = useState<string | null>(null)
  const [adminBidManager, setAdminBidManager] = useState('')
  const [adminBidAmount, setAdminBidAmount] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
    }
  }, [status, router])

  useEffect(() => {
    fetchAuctionData()
    fetchManagers()
    
    // Set up polling for real-time updates every 2 seconds
    // Only poll if auction is active (status is 'OPEN')
    const interval = setInterval(() => {
      if (auctionStatusRef.current === 'OPEN') {
        fetchAuctionData()
        fetchManagers() // Also refresh managers to get live budget updates
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [])

  const fetchAuctionData = async () => {
    try {
      const response = await fetch('/api/auction/current')
      if (response.ok) {
        const data = await response.json()
        setAuction(data.auction)
        setCurrentLot(data.currentLot)
        setCurrentIndex(data.currentIndex)
        
        // Update the ref with current auction status
        if (data.auction) {
          auctionStatusRef.current = data.auction.status
        } else {
          auctionStatusRef.current = 'CLOSED'
        }
      }
    } catch (error) {
      console.error('Error fetching auction data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchManagers = async () => {
    try {
      const response = await fetch('/api/managers')
      if (response.ok) {
        const data = await response.json()
        setManagers(data)
      }
    } catch (error) {
      console.error('Error fetching managers:', error)
    }
  }

  const placeBid = async (bidType: 'SP' | '+0.5' | '+1.0' | '+2.0' | 'OPEN+0.5' | 'ALL_IN') => {
    if (!currentLot) return

    try {
      const response = await fetch('/api/auction/bid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lotId: currentLot.id,
          bidType,
        }),
      })

      if (response.ok) {
        fetchAuctionData() // Refresh to show new bid
        fetchManagers() // Also refresh managers to show updated budgets
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to place bid')
      }
    } catch (error) {
      console.error('Error placing bid:', error)
      alert('Failed to place bid')
    }
  }

  const sellPlayer = async (managerId?: string) => {
    if (!currentLot) return

    let price = 0
    if (managerId) {
      price = parseFloat(customPrice) * 2 // Convert £m to half-million units
      if (!price || price <= 0) {
        alert('Please enter a valid price')
        return
      }
    }

    console.log('Selling player manually - lot:', currentLot.id, 'manager:', managerId, 'price:', price)
    try {
      const response = await fetch('/api/admin/auction/sell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lotId: currentLot.id,
          managerId: managerId || null,
          priceHalfM: price,
        }),
      })

      console.log('Manual sale response status:', response.status)
      if (response.ok) {
        console.log('Manual sale successful, refreshing data')
        fetchAuctionData() // Refresh to show next player
        fetchManagers() // Also refresh managers to show updated budgets
        setCustomPrice('')
        setSelectedManager('')
      } else {
        const error = await response.json()
        console.error('Manual sale failed:', error)
        alert(error.error || 'Failed to sell player')
      }
    } catch (error) {
      console.error('Error selling player:', error)
      alert('Failed to sell player')
    }
  }

  const sellToHighestBidder = async () => {
    if (!currentLot) return

    console.log('Selling to highest bidder for lot:', currentLot.id)
    try {
      const response = await fetch('/api/admin/auction/sell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lotId: currentLot.id,
          managerId: null,
          priceHalfM: 0,
        }),
      })

      console.log('Response status:', response.status)
      if (response.ok) {
        console.log('Sale successful, refreshing data')
        // Small delay to allow DB transaction to commit before refetch
        setTimeout(() => {
          fetchAuctionData()
          fetchManagers() // Also refresh managers to show updated budgets
        }, 150)
      } else {
        const error = await response.json()
        console.error('Sale failed:', error)
        alert(error.error || 'Failed to sell player')
      }
    } catch (error) {
      console.error('Error selling player:', error)
      alert('Failed to sell player')
    }
  }

  const skipPlayer = async () => {
    if (!currentLot) return

    try {
      const response = await fetch('/api/admin/auction/unsold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lotId: currentLot.id,
        }),
      })

      if (response.ok) {
        fetchAuctionData() // Refresh to show next player
        fetchManagers() // Also refresh managers to show updated budgets
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to mark player as unsold')
      }
    } catch (error) {
      console.error('Error marking player as unsold:', error)
      alert('Failed to mark player as unsold')
    }
  }

  const skipToPlayer = async (lotId: string) => {
    try {
      const response = await fetch('/api/admin/auction/skip-to-player', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lotId }),
      })

      if (response.ok) {
        fetchAuctionData() // Refresh to show the new current player
        fetchManagers() // Also refresh managers to show updated budgets
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to skip to player')
      }
    } catch (error) {
      console.error('Error skipping to player:', error)
      alert('Failed to skip to player')
    }
  }

  const placeAdminBid = async () => {
    if (!currentLot || !adminBidManager || !adminBidAmount) {
      alert('Please select a manager and enter a bid amount')
      return
    }

    const bidAmount = parseFloat(adminBidAmount) * 2 // Convert £m to half-million units
    if (!bidAmount || bidAmount <= 0) {
      alert('Please enter a valid bid amount')
      return
    }

    try {
      const response = await fetch('/api/admin/auction/bid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lotId: currentLot.id,
          managerId: adminBidManager,
          amountHalfM: bidAmount,
        }),
      })

      if (response.ok) {
        fetchAuctionData() // Refresh to show new bid
        fetchManagers() // Also refresh managers to show updated budgets
        setAdminBidAmount('') // Clear the bid amount
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to place bid')
      }
    } catch (error) {
      console.error('Error placing admin bid:', error)
      alert('Failed to place bid')
    }
  }

  const formatPrice = (halfMillionUnits: number) => {
    return `£${(halfMillionUnits * 0.5).toFixed(1)}m`
  }

  const displayName = (p: Player) => {
    const web = p.webName || p.secondName
    return `${p.firstName} ${p.secondName} (${web})`
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

  const calculateAllInBid = () => {
    if (!myManager || !auction) return 0
    
    // Calculate spent amount from auction lots
    const totalSpent = myAllocatedPlayers.reduce((sum, lot) => 
      sum + (lot.soldPriceHalfM || 0), 0
    )
    
    // Budget - Spent = Remaining
    const startingBudgetHalfM = Math.floor(myManager.budgetKGBP / 500)
    const remainingBudgetHalfM = startingBudgetHalfM - totalSpent
    
    // Must be at least starting price
    return Math.max(startingPrice, remainingBudgetHalfM)
  }

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading auction...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  const isAdmin = session.user?.username === 'Admin01'
  const currentBid = currentLot?.bids[0]
  const startingPrice = currentLot?.player.nowCostHalfM || 0
  const myManager = managers.find(m => m.id === session.user?.id)
  const myAllocatedPlayers = (auction?.lots || []).filter(l => l.isSold && l.winnerId === session.user?.id)
  const myPlayersCount = myAllocatedPlayers.length

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {isAdmin && (
          <div className="mb-4 flex flex-wrap gap-2 justify-end">
            <Button
              onClick={async () => {
                const res = await fetch('/api/admin/auction/start', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ phase: 1 }),
                })
                if (res.ok) {
                  fetchAuctionData()
                  fetchManagers() // Also refresh managers to show updated budgets
                } else {
                  const e = await res.json().catch(() => ({}))
                  alert(e.error || 'Failed to start auction')
                }
              }}
            >
              Start Auction
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                const res = await fetch('/api/admin/auction/end', { method: 'POST' })
                if (res.ok) {
                  fetchAuctionData()
                  fetchManagers() // Also refresh managers to show updated budgets
                } else {
                  const e = await res.json().catch(() => ({}))
                  alert(e.error || 'Failed to end auction')
                }
              }}
            >
              End Auction
            </Button>
          </div>
        )}
        <div className="grid lg:grid-cols-4 gap-6">
          {/* Main Auction Area */}
          <div className="lg:col-span-3">
            {currentLot ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>
                      {currentLot.player.webName || currentLot.player.secondName}
                    </span>
                    <Badge className={getPositionColor(currentLot.player.elementType)}>
                      {currentLot.player.elementType}
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    <strong>{currentLot.player.firstName} {currentLot.player.secondName}</strong> • {currentLot.player.team.name}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center mb-6">
                    {!currentBid ? (
                      <p className="text-2xl font-bold text-blue-600">
                        Starting Price: {formatPrice(startingPrice)}
                      </p>
                    ) : (
                      <div>
                        <p className="text-2xl font-bold text-blue-600">
                          Current Bid: {formatPrice(currentBid.amountHalfM)}
                        </p>
                        <p className="text-sm text-gray-600">
                          by {currentBid.manager.username}
                        </p>
                      </div>
                    )}
                  </div>

                  {!isAdmin && myPlayersCount < 11 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      <Button 
                        onClick={() => placeBid('SP')} 
                        className="h-12"
                        disabled={!!currentBid}
                        variant={currentBid ? "outline" : "default"}
                      >
                        SP<br />
                        <span className="text-xs">{formatPrice(startingPrice)}</span>
                      </Button>
                      <Button onClick={() => placeBid('+0.5')} variant="outline" className="h-12">
                        +0.5<br />
                        <span className="text-xs">{formatPrice((currentBid?.amountHalfM || startingPrice) + 1)}</span>
                      </Button>
                      <Button onClick={() => placeBid('+1.0')} variant="outline" className="h-12">
                        +1.0<br />
                        <span className="text-xs">{formatPrice((currentBid?.amountHalfM || startingPrice) + 2)}</span>
                      </Button>
                      <Button onClick={() => placeBid('+2.0')} variant="outline" className="h-12">
                        +2.0<br />
                        <span className="text-xs">{formatPrice((currentBid?.amountHalfM || startingPrice) + 4)}</span>
                      </Button>
                      {myPlayersCount === 10 && (
                        <Button onClick={() => placeBid('ALL_IN')} variant="destructive" className="h-12 col-span-2 md:col-span-4">
                          ALL IN<br />
                          <span className="text-xs">{formatPrice(calculateAllInBid())}</span>
                        </Button>
                      )}
                    </div>
                  )}

                  {isAdmin && (
                    <div className="space-y-6">
                      {/* Admin Bid Section */}
                      <div className="border-t pt-4">
                        <h3 className="text-lg font-semibold mb-4">Place Bid for Manager</h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Select Manager</Label>
                            <Select value={adminBidManager} onValueChange={setAdminBidManager}>
                              <SelectTrigger>
                                <SelectValue placeholder="Choose manager to bid for" />
                              </SelectTrigger>
                              <SelectContent>
                                {managers.map(manager => {
                                  const allocatedPlayers = auction?.lots.filter(lot => 
                                    lot.isSold && lot.winnerId === manager.id
                                  ) || []
                                  const totalSpent = allocatedPlayers.reduce((sum, lot) => 
                                    sum + (lot.soldPriceHalfM || 0), 0
                                  )
                                  const remainingBudget = manager.budgetKGBP - (totalSpent * 500)
                                  return (
                                    <SelectItem key={manager.id} value={manager.id}>
                                      {manager.username} - {formatPrice(remainingBudget / 500)}
                                    </SelectItem>
                                  )
                                })}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Bid Amount (£m)</Label>
                            <Input
                              type="number"
                              step="0.5"
                              value={adminBidAmount}
                              onChange={(e) => setAdminBidAmount(e.target.value)}
                              placeholder="Enter bid amount"
                            />
                          </div>
                        </div>
                        <div className="mt-4">
                          <Button onClick={placeAdminBid} className="w-full" variant="secondary">
                            PLACE BID FOR MANAGER
                          </Button>
                        </div>
                      </div>

                      {/* Admin Sale Controls */}
                      <div className="border-t pt-4">
                        <h3 className="text-lg font-semibold mb-4">Sale Controls</h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Select Manager</Label>
                            <Select value={selectedManager} onValueChange={setSelectedManager}>
                              <SelectTrigger>
                                <SelectValue placeholder="Choose manager" />
                              </SelectTrigger>
                              <SelectContent>
                                {managers.map(manager => {
                                  const allocatedPlayers = auction?.lots.filter(lot => 
                                    lot.isSold && lot.winnerId === manager.id
                                  ) || []
                                  const totalSpent = allocatedPlayers.reduce((sum, lot) => 
                                    sum + (lot.soldPriceHalfM || 0), 0
                                  )
                                  const remainingBudget = manager.budgetKGBP - (totalSpent * 500)
                                  return (
                                    <SelectItem key={manager.id} value={manager.id}>
                                      {manager.username} - {formatPrice(remainingBudget / 500)}
                                    </SelectItem>
                                  )
                                })}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Price (£m)</Label>
                            <Input
                              type="number"
                              step="0.5"
                              value={customPrice}
                              onChange={(e) => setCustomPrice(e.target.value)}
                              placeholder="Enter price"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2 mt-4">
                          <Button onClick={sellToHighestBidder} className="flex-1" variant="default">
                            SOLD TO HIGHEST BIDDER
                          </Button>
                          <Button onClick={() => sellPlayer(selectedManager)} className="flex-1" variant="outline">
                            SOLD TO SELECTED
                          </Button>
                          <Button onClick={skipPlayer} variant="outline">
                            UNSOLD
                          </Button>
                          <Button onClick={async () => {
                            const targetLotId = selectedLotId || currentLot?.id
                            if (!targetLotId) return
                            const res = await fetch('/api/admin/auction/reopen', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ lotId: targetLotId })
                            })
                            if (res.ok) {
                              fetchAuctionData()
                              fetchManagers() // Also refresh managers to show updated budgets
                              setSelectedLotId(null)
                            } else {
                              const err = await res.json().catch(() => ({}))
                              alert(err.error || 'Failed to reopen lot')
                            }
                          }} variant="secondary">
                            REOPEN LOT
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="text-center py-12">
                  <h2 className="text-2xl font-bold mb-4">No Active Auction</h2>
                  <p className="text-gray-600">Wait for the admin to start an auction.</p>
                </CardContent>
              </Card>
            )}

            {isAdmin && (
              <>
                {/* Admin: Player List in main body */}
                <Card className="mt-6">
                  <CardHeader>
                    <CardTitle>Player List</CardTitle>
                    <CardDescription>
                      {currentIndex + 1} of {auction?.lots.length || 0}
                    </CardDescription>
                    <div className="mt-2">
                      <Select value={positionFilter} onValueChange={setPositionFilter}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Filter by position" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ALL">All Positions</SelectItem>
                          <SelectItem value="GK">Goalkeepers</SelectItem>
                          <SelectItem value="DEF">Defenders</SelectItem>
                          <SelectItem value="MID">Midfielders</SelectItem>
                          <SelectItem value="FWD">Forwards</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-96 overflow-y-auto space-y-2">
                      {auction?.lots
                        .filter(lot => positionFilter === 'ALL' || lot.player.elementType === positionFilter)
                        .map((lot, displayIndex) => {
                          const originalIndex = auction.lots.findIndex(l => l.id === lot.id)
                          const playerNumber = originalIndex + 1 // Player numbers start from 1
                          return (
                        <div
                          key={lot.id}
                          className={`p-2 rounded ${
                            originalIndex === currentIndex
                              ? 'bg-blue-100 border border-blue-300'
                              : selectedLotId === lot.id
                              ? 'bg-purple-100 border border-purple-300'
                              : lot.isSold
                              ? 'bg-gray-100'
                              : 'hover:bg-gray-50 hover:border hover:border-gray-300'
                          } cursor-pointer`}
                          onClick={() => {
                            if (!lot.isSold) {
                              skipToPlayer(lot.id)
                              setSelectedLotId(null)
                            } else {
                              setSelectedLotId(prev => (prev === lot.id ? null : lot.id))
                            }
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-xs font-bold text-gray-700">
                                {playerNumber}
                              </div>
                              <div>
                                <p className="font-medium text-sm">
                                  {displayName(lot.player)}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {lot.player.team.name} • {formatPrice(lot.player.nowCostHalfM)}
                                </p>
                              </div>
                            </div>
                            <Badge
                              className={`text-xs ${getPositionColor(lot.player.elementType)}`}
                            >
                              {lot.player.elementType}
                            </Badge>
                          </div>
                          {lot.isSold && (
                            <p className="text-xs mt-1">
                              {lot.winnerId ? (
                                lot.winner ? 
                                  <span className="text-green-600">{`SOLD to ${lot.winner.username} - ${formatPrice(lot.soldPriceHalfM || 0)}`}</span> :
                                  <span className="text-green-600">{`SOLD - ${formatPrice(lot.soldPriceHalfM || 0)}`}</span>
                              ) : <span className="text-orange-600">UNSOLD</span>}
                            </p>
                          )}
                        </div>
                          )
                        })}
                    </div>
                  </CardContent>
                </Card>

                {/* Admin: Manager Squads below player list */}
                <Card className="mt-6">
                  <CardHeader>
                    <CardTitle>Manager Squads</CardTitle>
                    <CardDescription>Budget: £150m | Spent: amount spent | Remaining: budget - spent</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {managers.map(manager => {
                        const allocatedPlayers = auction?.lots.filter(lot => 
                          lot.isSold && lot.winnerId === manager.id
                        ) || []
                        const totalSpent = allocatedPlayers.reduce((sum, lot) => 
                          sum + (lot.soldPriceHalfM || 0), 0
                        )
                        // Budget terminology: Budget (starting £150m) - Spent = Remaining
                        const budget = manager.budgetKGBP // Starting budget (£150m)
                        const remainingBudget = budget - (totalSpent * 500)
                        return (
                          <div key={manager.id} className="p-3 border rounded-lg">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <p className="font-medium text-sm">{manager.username}</p>
                              </div>
                              <Badge variant="outline">
                                {formatPrice(remainingBudget / 500)}
                              </Badge>
                            </div>
                            <div className="text-xs text-gray-600">
                              <p>Spent: {formatPrice(totalSpent)}</p>
                              <p>Players: {allocatedPlayers.length}</p>
                            </div>
                            {allocatedPlayers.length > 0 && (
                              <div className="mt-3">
                                <p className="text-xs font-medium text-gray-700 mb-2">Players:</p>
                                <div className="grid grid-cols-4 gap-2">
                                  {(['GK','DEF','MID','FWD'] as const).map(pos => (
                                    <div key={pos} className="border rounded p-2">
                                      <p className="text-[10px] font-semibold mb-1">{pos}</p>
                                      <div className="space-y-1">
                                        {allocatedPlayers
                                          .filter(l => l.player.elementType === pos)
                                          .sort((a,b) => (a.player.webName || a.player.secondName).localeCompare(b.player.webName || b.player.secondName))
                                          .map(l => (
                                            <p key={l.id} className="text-[10px] text-gray-700 truncate flex justify-between gap-2">
                                              <span>{(l.player.webName || l.player.secondName)}</span>
                                              <span className="text-gray-500">{formatPrice(l.soldPriceHalfM || 0)}</span>
                                            </p>
                                          ))}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>

          {/* Sidebar (only for non-admin) */}
          {!isAdmin && (
          <div className="lg:col-span-1">
            <Card className="mb-4">
              <CardHeader>
                <CardTitle>{isAdmin ? 'Manager Budgets' : 'Your Budget'}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(isAdmin ? managers : managers.filter(m => m.id === session?.user?.id)).map(manager => {
                    const allocatedPlayers = auction?.lots.filter(lot => 
                      lot.isSold && lot.winnerId === manager.id
                    ) || []
                    const totalSpent = allocatedPlayers.reduce((sum, lot) => 
                      sum + (lot.soldPriceHalfM || 0), 0
                    )
                    // Budget terminology: Budget (starting £150m) - Spent = Remaining
                    const budget = manager.budgetKGBP // Starting budget (£150m)
                    const remainingBudget = budget - (totalSpent * 500)
                    
                    return (
                      <div key={manager.id} className="p-3 border rounded-lg">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="font-medium text-sm">{manager.username}</p>
                          </div>
                          <Badge variant="outline">
                            {formatPrice(remainingBudget / 500)}
                          </Badge>
                        </div>
                        <div className="text-xs text-gray-600">
                          <p>Spent: {formatPrice(totalSpent)}</p>
                          <p>Players: {allocatedPlayers.length}</p>
                        </div>
                        {allocatedPlayers.length > 0 && (
                          <div className="mt-3">
                            <p className="text-xs font-medium text-gray-700 mb-2">Players:</p>
                            <div className="grid grid-cols-4 gap-2">
                              {(['GK','DEF','MID','FWD'] as const).map(pos => (
                                <div key={pos} className="border rounded p-2">
                                  <p className="text-[10px] font-semibold mb-1">{pos}</p>
                                  <div className="space-y-1">
                                    {allocatedPlayers
                                      .filter(l => l.player.elementType === pos)
                                      .sort((a,b) => (a.player.webName || a.player.secondName).localeCompare(b.player.webName || b.player.secondName))
                                      .map(l => (
                                        <p key={l.id} className="text-[10px] text-gray-700 truncate flex justify-between gap-2">
                                          <span>{(l.player.webName || l.player.secondName)}</span>
                                          <span className="text-gray-500">{formatPrice(l.soldPriceHalfM || 0)}</span>
                                        </p>
                                      ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Player List</CardTitle>
                <CardDescription>
                  {currentIndex + 1} of {auction?.lots.length || 0}
                </CardDescription>
                <div className="mt-2">
                  <Select value={positionFilter} onValueChange={setPositionFilter}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Filter by position" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Positions</SelectItem>
                      <SelectItem value="GK">Goalkeepers</SelectItem>
                      <SelectItem value="DEF">Defenders</SelectItem>
                      <SelectItem value="MID">Midfielders</SelectItem>
                      <SelectItem value="FWD">Forwards</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <div className="max-h-96 overflow-y-auto space-y-2">
                  {auction?.lots
                    .filter(lot => positionFilter === 'ALL' || lot.player.elementType === positionFilter)
                    .map((lot, displayIndex) => {
                      const originalIndex = auction.lots.findIndex(l => l.id === lot.id)
                      const playerNumber = originalIndex + 1 // Player numbers start from 1
                      return (
                    <div
                      key={lot.id}
                      className={`p-2 rounded ${
                        originalIndex === currentIndex
                          ? 'bg-blue-100 border border-blue-300'
                          : selectedLotId === lot.id
                          ? 'bg-purple-100 border border-purple-300'
                          : lot.isSold
                          ? 'bg-gray-100'
                          : isAdmin 
                          ? 'hover:bg-gray-50 hover:border hover:border-gray-300'
                          : ''
                      } ${isAdmin ? 'cursor-pointer' : 'cursor-default'}`}
                      onClick={() => {
                        if (!isAdmin) return
                        if (!lot.isSold) {
                          skipToPlayer(lot.id)
                          setSelectedLotId(null)
                        } else {
                          setSelectedLotId(prev => (prev === lot.id ? null : lot.id))
                        }
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-xs font-bold text-gray-700">
                            {playerNumber}
                          </div>
                          <div>
                            <p className="font-medium text-sm">
                              {displayName(lot.player)}
                            </p>
                            <p className="text-xs text-gray-500">
                              {lot.player.team.name} • {formatPrice(lot.player.nowCostHalfM)}
                            </p>
                          </div>
                        </div>
                        <Badge
                          className={`text-xs ${getPositionColor(lot.player.elementType)}`}
                        >
                          {lot.player.elementType}
                        </Badge>
                      </div>
                      {lot.isSold && (
                        <p className="text-xs mt-1">
                          {lot.winnerId ? (
                            lot.winner ? 
                              <span className="text-green-600">{`SOLD to ${lot.winner.username} - ${formatPrice(lot.soldPriceHalfM || 0)}`}</span> :
                              <span className="text-green-600">{`SOLD - ${formatPrice(lot.soldPriceHalfM || 0)}`}</span>
                          ) : <span className="text-orange-600">UNSOLD</span>}
                        </p>
                      )}
                    </div>
                      )
                    })}
                </div>
              </CardContent>
            </Card>
          </div>
          )}
        </div>
      </div>
    </div>
  )
}

