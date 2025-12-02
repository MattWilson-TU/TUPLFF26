'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

type User = { id: string; username: string; name: string; budgetKGBP: number }
type Player = { 
  id: number; 
  webName: string; 
  firstName: string; 
  secondName: string; 
  elementType: string; 
  team: { name: string; shortName: string } 
}

type SquadPlayer = {
  id: number
  webName: string
  elementType: string
  teamName: string
  feeHalfM: number
  isReleased?: boolean
}

export default function TeamManagementPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [selectedManager, setSelectedManager] = useState<string>('')
  const [selectedPhase, setSelectedPhase] = useState<number>(1)
  const [squadPlayers, setSquadPlayers] = useState<SquadPlayer[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isAllocating, setIsAllocating] = useState(false)
  const [isLoadingSquad, setIsLoadingSquad] = useState(false)
  const [currentManager, setCurrentManager] = useState<User | null>(null)
  const [managerBudgetInfo, setManagerBudgetInfo] = useState<{
    startingBudgetHalfM: number
    spentHalfM: number
    remainingHalfM: number
  } | null>(null)
  const [feeInputs, setFeeInputs] = useState<{ [key: number]: string }>({})

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/signin')
  }, [status, router])

  useEffect(() => {
    if (session?.user?.username !== 'Admin01') router.push('/dashboard')
    else fetchUsers()
  }, [session])

  async function fetchUsers() {
    const res = await fetch('/api/admin/users')
    if (res.ok) setUsers(await res.json())
  }

  async function fetchManagerBudget(managerId: string) {
    try {
      const res = await fetch(`/api/admin/teams/budget/${managerId}`)
      if (res.ok) {
        const budgetInfo = await res.json()
        setManagerBudgetInfo(budgetInfo)
      } else {
        // Fallback to basic calculation
        const manager = users.find(u => u.id === managerId)
        if (manager) {
          const startingBudgetHalfM = Math.floor(manager.budgetKGBP / 500)
          setManagerBudgetInfo({
            startingBudgetHalfM,
            spentHalfM: 0,
            remainingHalfM: startingBudgetHalfM
          })
        }
      }
    } catch (error) {
      console.error('Error fetching manager budget:', error)
      // Fallback to basic calculation
      const manager = users.find(u => u.id === managerId)
      if (manager) {
        const startingBudgetHalfM = Math.floor(manager.budgetKGBP / 500)
        setManagerBudgetInfo({
          startingBudgetHalfM,
          spentHalfM: 0,
          remainingHalfM: startingBudgetHalfM
        })
      }
    }
  }

  async function fetchSquadData(managerId: string, phase: number) {
    try {
      setIsLoadingSquad(true)
      const res = await fetch(`/api/admin/teams/squad/${managerId}/${phase}`)
      if (res.ok) {
        const data = await res.json()
        
        if (data.players && data.players.length > 0) {
          // Load existing squad data
          const loadedSquad = Array(11).fill(null).map((_, index) => {
            const existingPlayer = data.players[index]
            return existingPlayer || {
              id: 0,
              webName: '',
              elementType: '',
              teamName: '',
              feeHalfM: 0
            }
          })
          setSquadPlayers(loadedSquad)
          
          // Set fee inputs for display
          const feeInputsData: { [key: number]: string } = {}
          data.players.forEach((player, index) => {
            if (player && player.feeHalfM > 0) {
              feeInputsData[index] = (player.feeHalfM * 0.5).toString()
            }
          })
          setFeeInputs(feeInputsData)
        } else {
          // No existing squad, check if we should load previous phase
          if (phase > 1) {
            await loadPreviousPhaseSquad(managerId, phase - 1)
          } else {
            // Phase 1 with no existing squad, start fresh
            clearSquad()
          }
        }
      } else {
        // Error fetching squad, start fresh
        clearSquad()
      }
    } catch (error) {
      console.error('Error fetching squad data:', error)
      clearSquad()
    } finally {
      setIsLoadingSquad(false)
    }
  }

  async function loadPreviousPhaseSquad(managerId: string, previousPhase: number) {
    try {
      const res = await fetch(`/api/admin/teams/squad/${managerId}/${previousPhase}`)
      if (res.ok) {
        const data = await res.json()
        
        if (data.players && data.players.length > 0) {
          // Load previous phase squad as starting point
          const loadedSquad = Array(11).fill(null).map((_, index) => {
            const existingPlayer = data.players[index]
            return existingPlayer || {
              id: 0,
              webName: '',
              elementType: '',
              teamName: '',
              feeHalfM: 0
            }
          })
          setSquadPlayers(loadedSquad)
          
          // Set fee inputs for display
          const feeInputsData: { [key: number]: string } = {}
          data.players.forEach((player, index) => {
            if (player && player.feeHalfM > 0) {
              feeInputsData[index] = (player.feeHalfM * 0.5).toString()
            }
          })
          setFeeInputs(feeInputsData)
        } else {
          clearSquad()
        }
      } else {
        clearSquad()
      }
    } catch (error) {
      console.error('Error loading previous phase squad:', error)
      clearSquad()
    }
  }

  async function fetchPlayer(playerId: string, rowIndex: number) {
    if (!playerId) return

    try {
      setIsLoading(true)
      const res = await fetch(`/api/players/${playerId}`)
      if (res.ok) {
        const player = await res.json()
        const webName = player.webName || `${player.firstName} ${player.secondName}`
        
        setSquadPlayers(prev => {
          const newPlayers = [...prev]
          newPlayers[rowIndex] = {
            id: player.id,
            webName: webName,
            elementType: player.elementType,
            teamName: player.team.name,
            feeHalfM: newPlayers[rowIndex]?.feeHalfM || 0
          }
          return newPlayers
        })
      } else {
        alert('Player not found')
      }
    } catch (error) {
      console.error('Error fetching player:', error)
      alert('Error fetching player')
    } finally {
      setIsLoading(false)
    }
  }

  function updatePlayerId(rowIndex: number, playerId: string) {
    if (playerId) {
      fetchPlayer(playerId, rowIndex)
    } else {
      setSquadPlayers(prev => {
        const newPlayers = [...prev]
        newPlayers[rowIndex] = {
          id: 0,
          webName: '',
          elementType: '',
          teamName: '',
          feeHalfM: newPlayers[rowIndex]?.feeHalfM || 0
        }
        return newPlayers
      })
    }
  }

  function updatePlayerFeeInput(rowIndex: number, feeString: string) {
    // Update the input display state
    setFeeInputs(prev => ({
      ...prev,
      [rowIndex]: feeString
    }))
    
    // Update the actual squad data
    setSquadPlayers(prev => {
      const newPlayers = [...prev]
      if (newPlayers[rowIndex]) {
        // Convert from £m format (xx.x) to half-million units
        const feeInM = parseFloat(feeString) || 0
        const feeHalfM = Math.round(feeInM * 2) // Convert to half-million units
        newPlayers[rowIndex].feeHalfM = feeHalfM
      }
      return newPlayers
    })
  }

  function getFeeDisplayValue(rowIndex: number, player: SquadPlayer | null) {
    // If there's a user input in progress, use that
    if (feeInputs[rowIndex] !== undefined) {
      return feeInputs[rowIndex]
    }
    // Otherwise, display the stored value
    return player?.feeHalfM > 0 ? (player.feeHalfM * 0.5).toString() : ''
  }

  function releasePlayer(rowIndex: number) {
    setSquadPlayers(prev => {
      const newPlayers = [...prev]
      if (newPlayers[rowIndex]) {
        newPlayers[rowIndex] = {
          id: 0,
          webName: '',
          elementType: '',
          teamName: '',
          feeHalfM: 0,
          isReleased: true
        }
      }
      return newPlayers
    })
  }

  function clearSquad() {
    setSquadPlayers(Array(11).fill(null).map(() => ({
      id: 0,
      webName: '',
      elementType: '',
      teamName: '',
      feeHalfM: 0
    })))
    setFeeInputs({})
  }

  function getTotalSpend() {
    return squadPlayers.reduce((sum, player) => sum + (player?.feeHalfM || 0), 0)
  }

  function getPositionCounts() {
    const counts = { GK: 0, DEF: 0, MID: 0, FWD: 0 }
    squadPlayers.forEach(player => {
      if (player && player.id > 0) {
        counts[player.elementType as keyof typeof counts]++
      }
    })
    return counts
  }

  function getRemainingBudget() {
    if (!managerBudgetInfo) return 0
    
    // For Phase 1, use the full starting budget (don't subtract current allocation for validation)
    // For later phases, use the actual remaining budget from the database
    if (selectedPhase === 1) {
      return managerBudgetInfo.startingBudgetHalfM
    } else {
      // For later phases, use the actual remaining budget
      return managerBudgetInfo.remainingHalfM
    }
  }

  function getAvailableBudget() {
    if (!managerBudgetInfo) return 0
    
    // For display purposes, show available budget after subtracting current allocation
    if (selectedPhase === 1) {
      const totalSpendHalfM = getTotalSpend()
      return managerBudgetInfo.startingBudgetHalfM - totalSpendHalfM
    } else {
      // For later phases, use the actual remaining budget
      return managerBudgetInfo.remainingHalfM
    }
  }

  function getPositionColor(position: string) {
    switch (position) {
      case 'GK': return 'bg-green-100 text-green-800'
      case 'DEF': return 'bg-blue-100 text-blue-800'
      case 'MID': return 'bg-yellow-100 text-yellow-800'
      case 'FWD': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  useEffect(() => {
    // Initialize squad with 11 empty slots
    if (squadPlayers.length === 0) {
      setSquadPlayers(Array(11).fill(null).map(() => ({
        id: 0,
        webName: '',
        elementType: '',
        teamName: '',
        feeHalfM: 0
      })))
    }
  }, [])

  useEffect(() => {
    // Update current manager when selection changes
    if (selectedManager) {
      const manager = users.find(u => u.id === selectedManager)
      setCurrentManager(manager || null)
      fetchManagerBudget(selectedManager)
      fetchSquadData(selectedManager, selectedPhase)
    } else {
      setCurrentManager(null)
      setManagerBudgetInfo(null)
      clearSquad()
    }
  }, [selectedManager, users])

  useEffect(() => {
    // Load squad data when phase changes
    if (selectedManager) {
      fetchSquadData(selectedManager, selectedPhase)
    }
  }, [selectedPhase])

  async function allocateSquad() {
    if (!selectedManager) {
      alert('Please select a manager')
      return
    }

    const validPlayers = squadPlayers.filter(p => p && p.id > 0 && p.feeHalfM > 0)
    
    if (validPlayers.length === 0) {
      alert('Please add at least one player with a valid fee')
      return
    }

    if (validPlayers.some(p => p.feeHalfM <= 0)) {
      alert('Please set a fee for all players')
      return
    }

    const totalSpend = getTotalSpend()
    const remainingBudget = getRemainingBudget()

    if (totalSpend > remainingBudget) {
      alert(`Insufficient budget. Required: £${(totalSpend * 0.5).toFixed(1)}m, Available: £${(remainingBudget * 0.5).toFixed(1)}m`)
      return
    }

    if (!confirm(`Allocate ${validPlayers.length} players to ${users.find(u => u.id === selectedManager)?.username} for £${(totalSpend * 0.5).toFixed(1)}m in phase ${selectedPhase}?`)) {
      return
    }

    try {
      setIsAllocating(true)
      const res = await fetch('/api/admin/teams/bulk-allocate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          managerId: selectedManager,
          phase: selectedPhase,
          allocations: validPlayers.map(p => ({
            playerId: p.id,
            webName: p.webName,
            elementType: p.elementType,
            teamName: p.teamName,
            feeHalfM: p.feeHalfM
          }))
        })
      })

      if (res.ok) {
        alert('Squad allocated successfully!')
        clearSquad()
        fetchUsers() // Refresh to show updated budgets
      } else {
        const error = await res.json()
        alert(error.error || 'Failed to allocate squad')
      }
    } catch (error) {
      console.error('Error allocating squad:', error)
      alert('Failed to allocate squad')
    } finally {
      setIsAllocating(false)
    }
  }

  if (status === 'loading') return null

  const positionCounts = getPositionCounts()
  const totalSpend = getTotalSpend()
  const remainingBudget = getRemainingBudget()

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Button variant="outline" asChild>
              <Link href="/dashboard">← Back to Dashboard</Link>
            </Button>
            <h1 className="text-3xl font-bold text-gray-900">Team Management</h1>
          </div>
          <p className="text-gray-600">
            {selectedPhase === 1 ? 'Initial squad allocation' : `Phase ${selectedPhase} squad management`}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Manager Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Manager Selection</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="manager-select">Select Manager</Label>
                <Select 
                  value={selectedManager} 
                  onValueChange={setSelectedManager}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose manager" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.filter(u => u.username !== 'Admin01').map(user => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.username} ({user.name})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="phase-select">Phase</Label>
                <Select 
                  value={selectedPhase.toString()} 
                  onValueChange={(value) => setSelectedPhase(parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select phase" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Phase 1</SelectItem>
                    <SelectItem value="2">Phase 2</SelectItem>
                    <SelectItem value="3">Phase 3</SelectItem>
                    <SelectItem value="4">Phase 4</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {currentManager && managerBudgetInfo && (
                <div className="p-3 bg-gray-50 rounded">
                  <h4 className="font-medium">Budget Information</h4>
                  <p className="text-sm text-gray-600">
                    Starting Budget: £{(managerBudgetInfo.startingBudgetHalfM * 0.5).toFixed(1)}m
                  </p>
                  {selectedPhase > 1 && (
                    <p className="text-sm text-gray-600">
                      Previously Spent: £{(managerBudgetInfo.spentHalfM * 0.5).toFixed(1)}m
                    </p>
                  )}
                  <p className="text-sm font-medium">
                    Available: £{(getAvailableBudget() * 0.5).toFixed(1)}m
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Squad Table */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Squad Selection</CardTitle>
              <div className="flex justify-between items-center">
                <div className="flex gap-2">
                  {Object.entries(positionCounts).map(([position, count]) => (
                    <Badge key={position} className={getPositionColor(position)}>
                      {position}: {count}
                    </Badge>
                  ))}
                </div>
                <Button variant="outline" size="sm" onClick={clearSquad}>
                  Clear All
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingSquad ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">Loading squad data...</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Player ID</TableHead>
                      <TableHead>Player Name</TableHead>
                      <TableHead>Position</TableHead>
                      <TableHead>Team</TableHead>
                      <TableHead>Fee (£m)</TableHead>
                      {selectedPhase > 1 && <TableHead>Release</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {squadPlayers.map((player, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{index + 1}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          placeholder="ID"
                          value={player?.id > 0 ? player.id : ''}
                          onChange={(e) => updatePlayerId(index, e.target.value)}
                          className="w-20"
                        />
                      </TableCell>
                      <TableCell>
                        <span className={player?.webName ? 'font-medium' : 'text-gray-400'}>
                          {player?.webName || 'Enter player ID'}
                        </span>
                      </TableCell>
                      <TableCell>
                        {player?.elementType && (
                          <Badge className={getPositionColor(player.elementType)}>
                            {player.elementType}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-gray-600">
                          {player?.teamName || ''}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.5"
                          placeholder="0.0"
                          value={getFeeDisplayValue(index, player)}
                          onChange={(e) => updatePlayerFeeInput(index, e.target.value)}
                          className="w-20"
                        />
                      </TableCell>
                      {selectedPhase > 1 && (
                        <TableCell>
                          <Button 
                            variant="destructive" 
                            size="sm"
                            onClick={() => releasePlayer(index)}
                            disabled={!player || player.id === 0}
                          >
                            Release
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              {/* Total Spend & Allocate Button */}
              <div className="mt-6 pt-4 border-t">
                <div className="flex justify-between items-center mb-4">
                  <div className="text-lg font-bold">
                    Total Spend: £{(totalSpend * 0.5).toFixed(1)}m
                  </div>
                  <div className="text-sm text-gray-600">
                    Remaining Budget: £{(getAvailableBudget() * 0.5).toFixed(1)}m
                  </div>
                </div>
                
                <Button 
                  onClick={allocateSquad} 
                  disabled={isAllocating || totalSpend === 0}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  {isAllocating ? 'Allocating...' : `Allocate Squad for Phase ${selectedPhase}`}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
