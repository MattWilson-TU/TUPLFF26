'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

interface AuctionLot {
  id: string
  player: {
    id: number
    firstName: string
    secondName: string
    elementType: 'GK' | 'DEF' | 'MID' | 'FWD'
    nowCostHalfM: number
    totalPoints: number
    photo: string
  }
  isSold: boolean
  soldPriceHalfM?: number
  winner?: {
    username: string
  }
  bids: {
    id: string
    amountHalfM: number
    manager: {
      username: string
    }
    createdAt: string
  }[]
}

export default function AuctionPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [lots, setLots] = useState<AuctionLot[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [bidAmount, setBidAmount] = useState('')
  const [selectedLot, setSelectedLot] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
    }
  }, [status, router])

  useEffect(() => {
    fetchAuctionLots()
  }, [])

  const fetchAuctionLots = async () => {
    try {
      const response = await fetch('/api/auction')
      if (response.ok) {
        const auctions = await response.json()
        const allLots = auctions.flatMap((auction: any) => auction.lots || [])
        setLots(allLots)
      }
    } catch (error) {
      console.error('Error fetching auction lots:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleBid = async (lotId: string) => {
    if (!bidAmount || !session?.user?.id) return

    const amountHalfM = parseFloat(bidAmount) * 2 // Convert £0.5m to half-million units

    try {
      const response = await fetch('/api/auction/bid', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lotId,
          amountHalfM,
        }),
      })

      if (response.ok) {
        setBidAmount('')
        setSelectedLot(null)
        fetchAuctionLots() // Refresh the lots
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to place bid')
      }
    } catch (error) {
      console.error('Error placing bid:', error)
      alert('Failed to place bid')
    }
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

  const activeLots = lots.filter(lot => !lot.isSold)
  const soldLots = lots.filter(lot => lot.isSold)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Auction House</h1>
              <p className="text-gray-600 mt-2">
                Bid on players to build your dream squad
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href="/dashboard">← Back to Dashboard</Link>
            </Button>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Active Lots */}
          <Card>
            <CardHeader>
              <CardTitle>Active Lots</CardTitle>
              <CardDescription>
                Players currently up for auction
              </CardDescription>
            </CardHeader>
            <CardContent>
              {activeLots.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  No active lots at the moment
                </p>
              ) : (
                <div className="space-y-4">
                  {activeLots.map((lot) => (
                    <div key={lot.id} className="border rounded-lg p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={lot.player.photo} alt={`${lot.player.firstName} ${lot.player.secondName}`} />
                          <AvatarFallback>
                            {lot.player.firstName[0]}{lot.player.secondName[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <h3 className="font-medium">{lot.player.firstName} {lot.player.secondName}</h3>
                          <div className="flex items-center gap-2">
                            <Badge className={getPositionColor(lot.player.elementType)}>
                              {lot.player.elementType}
                            </Badge>
                            <span className="text-sm text-gray-500">
                              {formatPrice(lot.player.nowCostHalfM)} • {lot.player.totalPoints} pts
                            </span>
                          </div>
                        </div>
                      </div>

                      {lot.bids.length > 0 && (
                        <div className="mb-3">
                          <p className="text-sm font-medium mb-1">Current Bids:</p>
                          <div className="space-y-1">
                            {lot.bids.slice(0, 3).map((bid) => (
                              <div key={bid.id} className="flex justify-between text-sm">
                                <span>{bid.manager.name}</span>
                                <span className="font-medium">{formatPrice(bid.amountHalfM)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <Input
                          type="number"
                          step="0.5"
                          min="0.5"
                          placeholder="Bid amount (£m)"
                          value={selectedLot === lot.id ? bidAmount : ''}
                          onChange={(e) => {
                            setBidAmount(e.target.value)
                            setSelectedLot(lot.id)
                          }}
                          className="flex-1"
                        />
                        <Button
                          onClick={() => handleBid(lot.id)}
                          disabled={!bidAmount || selectedLot !== lot.id}
                        >
                          Bid
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sold Lots */}
          <Card>
            <CardHeader>
              <CardTitle>Sold Lots</CardTitle>
              <CardDescription>
                Recently sold players
              </CardDescription>
            </CardHeader>
            <CardContent>
              {soldLots.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  No sold lots yet
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Player</TableHead>
                      <TableHead>Position</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Winner</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {soldLots.slice(0, 10).map((lot) => (
                      <TableRow key={lot.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={lot.player.photo} alt={`${lot.player.firstName} ${lot.player.secondName}`} />
                              <AvatarFallback>
                                {lot.player.firstName[0]}{lot.player.secondName[0]}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium">
                              {lot.player.firstName} {lot.player.secondName}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getPositionColor(lot.player.elementType)}>
                            {lot.player.elementType}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium text-green-600">
                            {lot.soldPriceHalfM ? formatPrice(lot.soldPriceHalfM) : 'N/A'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{lot.winner?.username || 'Unknown'}</span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle>Auction Rules</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li>• Minimum bid increment: £0.5m</li>
                <li>• Each manager starts with £150m budget</li>
                <li>• Bids must be higher than the current highest bid</li>
                <li>• Players are sold to the highest bidder</li>
                <li>• Squad must contain exactly 11 players</li>
                <li>• Valid formations: 1-3-5-2, 1-4-4-2, 1-4-3-3, 1-4-5-1</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}



