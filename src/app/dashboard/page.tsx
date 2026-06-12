'use client'

import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useState } from 'react'

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  // All state declarations must be at the top
  const [quickStats, setQuickStats] = useState<{ position: number | null; totalPoints: number; last3ByGw: { gameweekId: number; points: number }[] } | null>(null)
  const [wc2026Summary, setWc2026Summary] = useState<{
    position: number | null
    totalPoints: number
    predictionsMade: number
  } | null>(null)
  const [wc2026LastUpdated, setWc2026LastUpdated] = useState<string | null>(null)
  const [wc2026Enrolled, setWc2026Enrolled] = useState(true)
  const [auctionStatus, setAuctionStatus] = useState<'OPEN' | 'CLOSED' | null>(null)
  const [myPlayers, setMyPlayers] = useState<Array<{
    id: number
    firstName: string
    secondName: string
    webName?: string
    elementType: 'GK' | 'DEF' | 'MID' | 'FWD'
    team: { name: string }
    priceHalfM: number
  }>>([])
  const [showSettings, setShowSettings] = useState(false)
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [passwordError, setPasswordError] = useState('')
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [currentPhase, setCurrentPhase] = useState<number | null>(null)
  const [dataLastUpdated, setDataLastUpdated] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
    }
  }, [status, router])

  const handleLogout = async () => {
    await signOut({ callbackUrl: '/' })
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError('')
    setIsChangingPassword(true)

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New passwords do not match')
      setIsChangingPassword(false)
      return
    }

    if (passwordForm.newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters')
      setIsChangingPassword(false)
      return
    }

    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword
        })
      })

      if (response.ok) {
        alert('Password changed successfully')
        setShowSettings(false)
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      } else {
        const error = await response.json()
        setPasswordError(error.error || 'Failed to change password')
      }
    } catch (error) {
      setPasswordError('An error occurred. Please try again.')
    } finally {
      setIsChangingPassword(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  useEffect(() => {
    async function loadQuickStats() {
      if (!session?.user?.id) return
      const res = await fetch('/api/managers/quick-stats')
      if (res.ok) setQuickStats(await res.json())
    }
    loadQuickStats()
  }, [session])

  useEffect(() => {
    async function loadWc2026Summary() {
      if (!session?.user?.id) return
      try {
        const [participationRes, standingsRes, updatedRes] = await Promise.all([
          fetch('/api/wc2026/participation'),
          fetch('/api/wc2026/standings'),
          fetch('/api/wc2026/last-updated'),
        ])
        if (participationRes.ok) {
          const participation = await participationRes.json()
          setWc2026Enrolled(participation.enabled === true)
        }
        if (standingsRes.ok) {
          const standings: Array<{
            id: string
            totalPoints: number
            predictionsMade: number
          }> = await standingsRes.json()
          const idx = standings.findIndex((s) => s.id === session.user.id)
          if (idx >= 0) {
            setWc2026Summary({
              position: idx + 1,
              totalPoints: standings[idx].totalPoints,
              predictionsMade: standings[idx].predictionsMade,
            })
          } else {
            setWc2026Summary({
              position: null,
              totalPoints: 0,
              predictionsMade: 0,
            })
          }
        }
        if (updatedRes.ok) {
          const data = await updatedRes.json()
          setWc2026LastUpdated(data.lastUpdated ?? null)
        }
      } catch (error) {
        console.error('Failed to load WC2026 summary', error)
      }
    }
    loadWc2026Summary()
  }, [session])

  useEffect(() => {
    async function loadAuctionStatus() {
      const res = await fetch('/api/auction/current')
      if (res.ok) {
        const data = await res.json()
        setAuctionStatus(data.auction?.status || null)
      }
    }
    loadAuctionStatus()
  }, [])

  useEffect(() => {
    async function loadDataLastUpdated() {
      try {
        const res = await fetch('/api/data/last-updated')
        if (!res.ok) return
        const data = await res.json()
        if (data?.lastUpdated) {
          setDataLastUpdated(data.lastUpdated)
        } else {
          setDataLastUpdated(null)
        }
      } catch (error) {
        console.error('Failed to load data last updated timestamp', error)
      }
    }
    loadDataLastUpdated()
  }, [])

  useEffect(() => {
    async function loadMyPlayers() {
      if (!session?.user?.id || auctionStatus !== 'CLOSED') return
      const res = await fetch('/api/my-team')
      if (res.ok) {
        const data = await res.json()
        setMyPlayers(data.currentPlayers || [])
      }
    }
    loadMyPlayers()
  }, [session, auctionStatus])

  useEffect(() => {
    async function loadCurrentPhase() {
      const res = await fetch('/api/gameweek/current-phase')
      if (res.ok) {
        const data = await res.json()
        setCurrentPhase(data.phase || null)
      }
    }
    loadCurrentPhase()
  }, [])

  if (!session) {
    return null
  }

  const last3 = quickStats?.last3ByGw || []

  const getPositionColor = (position: string) => {
    switch (position) {
      case 'GK': return 'bg-green-100 text-green-800'
      case 'DEF': return 'bg-blue-100 text-blue-800'
      case 'MID': return 'bg-yellow-100 text-yellow-800'
      case 'FWD': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Welcome back, {session.user?.name}!
              </h1>
              <p className="text-gray-600 mt-2">
                Manage your Fantasy Football team and track your progress
              </p>
            </div>
            <div className="flex gap-2">
              {session.user?.username === 'Admin01' && (
                <Button asChild variant="outline">
                  <Link href="/admin">Admin Panel</Link>
                </Button>
              )}
              <Button 
                onClick={() => setShowSettings(true)} 
                variant="outline" 
                size="sm"
                className="p-2"
              >
                ⚙️
              </Button>
              <Button onClick={handleLogout} variant="outline">
                Logout
              </Button>
            </div>
          </div>
        </div>

        {/* WC2026 summary at the top */}
        {wc2026Enrolled && (
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">WC2026 Predictor</h2>
            <Button asChild variant="outline" size="sm">
              <Link href="/wc2026">Open Predictor</Link>
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-sm text-gray-600">Standings position</p>
              <p className="text-2xl font-bold text-blue-600">{wc2026Summary?.position ?? '-'}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">Points scored</p>
              <p className="text-2xl font-bold text-purple-600">{wc2026Summary?.totalPoints ?? 0}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">Predictions made</p>
              <p className="text-2xl font-bold text-green-600">{wc2026Summary?.predictionsMade ?? 0}</p>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Separate ranking from the main league — 3 pts exact score, 1 pt correct outcome.
          </p>
          {wc2026LastUpdated && (
            <p className="text-xs text-gray-500 mt-1">
              Fixtures last updated:{' '}
              {new Date(wc2026LastUpdated).toLocaleString('en-GB', { timeZone: 'Europe/London' })} BST
            </p>
          )}
        </div>
        )}

        {/* Auction Summary - Show when auction is closed */}
        {auctionStatus === 'CLOSED' && myPlayers.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">🏆 Auction Complete - Your Squad</h2>
            <p className="text-gray-600 mb-4">
              Congratulations! You successfully acquired {myPlayers.length} players in the auction.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {myPlayers.map((player) => (
                <div key={player.id} className="border rounded-lg p-3 bg-gray-50">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-sm">
                      {player.webName || `${player.firstName} ${player.secondName}`}
                    </h3>
                    <Badge className={`text-xs ${getPositionColor(player.elementType)}`}>
                      {player.elementType}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-600 mb-1">{player.team.name}</p>
                  <p className="text-xs font-medium text-green-600">
                    £{(player.priceHalfM * 0.5).toFixed(1)}m
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Total Spent:</span>
                <span className="text-lg font-bold text-green-600">
                  £{(myPlayers.reduce((sum, p) => sum + (p.priceHalfM * 0.5), 0)).toFixed(1)}m
                </span>
              </div>
              <div className="flex justify-between items-center mt-2">
                <span className="text-sm font-medium">Remaining Budget:</span>
                <span className="text-lg font-bold text-blue-600">
                  £{(150 - myPlayers.reduce((sum, p) => sum + (p.priceHalfM * 0.5), 0)).toFixed(1)}m
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {wc2026Enrolled && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                🌍 WC2026 Predictor
                <Badge variant="secondary">World Cup</Badge>
              </CardTitle>
              <CardDescription>
                Predict World Cup scores and compete separately
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">
                Predict full-time scores for all 104 World Cup fixtures. 3 pts exact, 1 pt correct outcome.
              </p>
              <Button asChild className="w-full">
                <Link href="/wc2026">Open Predictor</Link>
              </Button>
            </CardContent>
          </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                ⚽ Auction
                <Badge variant={auctionStatus === 'OPEN' ? 'default' : 'outline'}>
                  {auctionStatus === 'OPEN' ? 'Active' : 'Closed'}
                </Badge>
              </CardTitle>
              <CardDescription>
                Bid on players for your squad
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">
                Participate in live auctions to build your dream team.
              </p>
              <Button asChild className="w-full">
                <Link href="/auction-room">Join Auction</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                📊 My Team
                {currentPhase !== null && (
                  <Badge variant="secondary">Phase {currentPhase}</Badge>
                )}
              </CardTitle>
              <CardDescription>
                View your current squad
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">
                Check your current squad.
              </p>
              <Button asChild className="w-full">
                <Link href="/my-team">View Team</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>🔍 Player Search</CardTitle>
              <CardDescription>
                Browse and analyze players
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">
                Search for players, view their stats, and see who owns them.
              </p>
              <Button asChild className="w-full">
                <Link href="/players">Browse Players</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>📈 Statistics</CardTitle>
              <CardDescription>
                Detailed performance metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">
                View detailed statistics and performance analysis.
              </p>
              <Button asChild className="w-full">
                <Link href="/stats">View Stats</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>⚙️ Transfers</CardTitle>
              <CardDescription>
                Manage your squad changes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">
                Make transfers between phases to optimize your squad.
              </p>
              <Button asChild className="w-full">
                <Link href="/transfers">Manage Transfers</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                🏆 League Table
                <Badge variant="secondary">Live</Badge>
              </CardTitle>
              <CardDescription>
                Current standings and points
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">
                View the current league table.
              </p>
              <Button asChild className="w-full">
                <Link href="/league">View League</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Quick Stats at the bottom */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Quick Stats</h2>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
            <div className="text-center">
              <p className="text-sm text-gray-600">Position</p>
              <p className="text-2xl font-bold text-blue-600">{quickStats?.position ?? '-'}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">Total Points</p>
              <p className="text-2xl font-bold text-purple-600">{quickStats?.totalPoints ?? 0}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">GW {last3[0]?.gameweekId ?? '-'} Points</p>
              <p className="text-2xl font-bold text-green-600">{last3[0]?.points ?? 0}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">GW {last3[1]?.gameweekId ?? '-'} Points</p>
              <p className="text-2xl font-bold text-green-600">{last3[1]?.points ?? 0}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">GW {last3[2]?.gameweekId ?? '-'} Points</p>
              <p className="text-2xl font-bold text-green-600">{last3[2]?.points ?? 0}</p>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">Latest GW may be in progress.</p>
          {dataLastUpdated && (
            <p className="text-xs text-gray-500 mt-1">
              Data last updated:{' '}
              {new Date(dataLastUpdated).toLocaleString()}
            </p>
          )}
        </div>

        {/* Settings Modal */}
        {showSettings && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md mx-4">
              <CardHeader>
                <CardTitle>Settings</CardTitle>
                <CardDescription>Change your password</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handlePasswordChange} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">Current Password</Label>
                    <Input
                      id="currentPassword"
                      type="password"
                      value={passwordForm.currentPassword}
                      onChange={(e) => setPasswordForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">New Password</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                      required
                      minLength={6}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      required
                    />
                  </div>
                  {passwordError && (
                    <p className="text-sm text-red-600">{passwordError}</p>
                  )}
                  <div className="flex gap-2 pt-4">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => {
                        setShowSettings(false)
                        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
                        setPasswordError('')
                      }}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={isChangingPassword}
                      className="flex-1"
                    >
                      {isChangingPassword ? 'Changing...' : 'Change Password'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
