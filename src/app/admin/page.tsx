'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type User = { id: string; username: string; name: string; budgetKGBP: number }

export default function AdminPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [form, setForm] = useState({ username: '', name: '', password: '', budgetKGBP: 150000 })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isRefreshingScores, setIsRefreshingScores] = useState(false)
  const [refreshProgress, setRefreshProgress] = useState<string>('')
  const [isUploadingData, setIsUploadingData] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string>('')
  const [isCloudUpdating, setIsCloudUpdating] = useState(false)
  const [cloudUpdateProgress, setCloudUpdateProgress] = useState<string>('')

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

  async function createUser() {
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      setForm({ username: '', name: '', password: '', budgetKGBP: 150000 })
      fetchUsers()
    }
  }

  async function updateUser(id: string, partial: Partial<User & { password: string }>) {
    const res = await fetch('/api/admin/users', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...partial }),
    })
    if (res.ok) {
      setEditingId(null)
      fetchUsers()
    }
  }

  async function deleteUser(id: string) {
    const res = await fetch(`/api/admin/users?id=${id}`, { method: 'DELETE' })
    if (res.ok) fetchUsers()
  }

  async function resetPassword(id: string) {
    if (!confirm('Are you sure you want to reset this user\'s password to "Password"?')) {
      return
    }
    
    const res = await fetch('/api/admin/users/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: id }),
    })
    
    if (res.ok) {
      alert('Password reset successfully to "Password"')
    } else {
      const error = await res.json()
      alert(error.error || 'Failed to reset password')
    }
  }

  async function refreshAllScores() {
    try {
      setIsRefreshingScores(true)
      setRefreshProgress('Checking finished and current gameweeks...')
      const res = await fetch('/api/gameweek/refresh-finished', { method: 'POST' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to refresh scores')
      }
      const payload = await res.json()
      setRefreshProgress(`Updated GWs: ${(payload.updatedGameweeks || []).join(', ')}`)
      alert('Managers\' scores refreshed for finished and current gameweek.')
    } catch (e: any) {
      console.error(e)
      alert(e.message || 'Failed to refresh scores')
    } finally {
      setIsRefreshingScores(false)
    }
  }

  async function addBudgetToAll() {
    if (!confirm('Are you sure you want to add £50m to all managers\' budgets?')) {
      return
    }

    try {
      const res = await fetch('/api/admin/users/add-budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 50000 }) // £50m in thousands
      })

      if (res.ok) {
        alert('Successfully added £50m to all managers\' budgets')
        fetchUsers() // Refresh the user list
      } else {
        const error = await res.json()
        alert(error.error || 'Failed to add budget')
      }
    } catch (error) {
      console.error('Error adding budget:', error)
      alert('Failed to add budget')
    }
  }

  async function uploadFPLData() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      setIsUploadingData(true)
      setUploadProgress('Reading file...')

      try {
        const text = await file.text()
        const data = JSON.parse(text)

        setUploadProgress('Uploading data...')
        
        const res = await fetch('/api/admin/upload-fpl-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        })

        if (res.ok) {
          const result = await res.json()
          alert(`FPL data uploaded successfully!\n\nSummary:\n- Gameweeks: ${result.summary.gameweeks}\n- Players: ${result.summary.players}\n- Point Entries: ${result.summary.pointEntries}`)
          setUploadProgress('')
        } else {
          const error = await res.json()
          alert(error.error || 'Failed to upload FPL data')
        }
      } catch (error) {
        alert('Failed to process file: ' + error)
      } finally {
        setIsUploadingData(false)
      }
    }
    input.click()
  }

  async function exportTeams() {
    try {
      const res = await fetch('/api/admin/export-teams')
      if (!res.ok) {
        const error = await res.json()
        alert(error.error || 'Failed to export teams')
        return
      }

      // Get the CSV content
      const csvContent = await res.text()
      
      // Create and download the file
      const blob = new Blob([csvContent], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'manager-teams-export.csv'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      
      alert('Teams exported successfully!')
    } catch (error) {
      console.error('Error exporting teams:', error)
      alert('Failed to export teams')
    }
  }

  async function cloudUpdateFPLData() {
    if (!confirm('Are you sure you want to trigger a cloud update? This will download the latest FPL data and update the database.')) {
      return
    }

    try {
      setIsCloudUpdating(true)
      setCloudUpdateProgress('Triggering cloud update job...')
      
      const res = await fetch('/api/admin/cloud-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (res.ok) {
        const result = await res.json()
        setCloudUpdateProgress(`Job triggered: ${result.execution.name}`)
        alert('Cloud update job triggered successfully! The update is running in the background. Check Cloud Run logs for progress.')
      } else {
        const error = await res.json()
        alert(error.error || 'Failed to trigger cloud update')
        setCloudUpdateProgress('')
      }
    } catch (error) {
      console.error('Error triggering cloud update:', error)
      alert('Failed to trigger cloud update')
      setCloudUpdateProgress('')
    } finally {
      setIsCloudUpdating(false)
    }
  }


  if (status === 'loading') return null

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Admin Panel</h1>
              <p className="text-gray-600 mt-2">Manage users and auctions</p>
            </div>
            <Button asChild variant="outline">
              <Link href="/dashboard">← Back to Dashboard</Link>
            </Button>
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Auction Management</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex gap-2 flex-wrap items-center">
                <Button 
                  onClick={async () => {
                    const res = await fetch('/api/admin/auction/clear', { method: 'POST' })
                    if (res.ok) alert('Auction data cleared')
                  }}
                  variant="destructive"
                >
                  Clear Auction Data
                </Button>
                <Button 
                  onClick={async () => {
                    const res = await fetch('/api/admin/auction/start', { 
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ phase: 1 })
                    })
                    if (res.ok) alert('Auction started')
                  }}
                >
                  Start Auction
                </Button>
                <Button 
                  onClick={async () => {
                    const res = await fetch('/api/admin/auction/end', { method: 'POST' })
                    if (res.ok) {
                      alert('Auction ended')
                    } else {
                      const error = await res.json()
                      alert(error.error || 'Failed to end auction')
                    }
                  }}
                  variant="destructive"
                >
                  End Auction
                </Button>
                <Button onClick={refreshAllScores} disabled={isRefreshingScores} variant="outline">
                  {isRefreshingScores ? 'Refreshing...' : 'Refresh Scores (Finished + Current GW)'}
                </Button>
                <Button onClick={uploadFPLData} disabled={isUploadingData} variant="outline">
                  {isUploadingData ? 'Uploading...' : '📤 Upload FPL Data'}
                </Button>
                <Button onClick={cloudUpdateFPLData} disabled={isCloudUpdating} variant="outline">
                  {isCloudUpdating ? 'Triggering...' : '☁️ Cloud Update'}
                </Button>
                {isRefreshingScores && (
                  <span className="text-sm text-gray-600">{refreshProgress}</span>
                )}
                {isUploadingData && (
                  <span className="text-sm text-gray-600">{uploadProgress}</span>
                )}
                {isCloudUpdating && (
                  <span className="text-sm text-gray-600">{cloudUpdateProgress}</span>
                )}
              </div>
              <div className="flex gap-2">
                <Button asChild>
                  <Link href="/auction-room">Go to Auction Room</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/admin/team-management">Team Management</Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>


        <Card>
          <CardHeader>
            <CardTitle>User Management</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center mb-4">
              <div className="grid md:grid-cols-4 gap-2 flex-1">
                <Input placeholder="Username" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />
                <Input placeholder="Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                <Input placeholder="Password" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
                <Button onClick={createUser}>Create</Button>
              </div>
              <div className="flex gap-2 ml-4">
                <Button 
                  onClick={addBudgetToAll} 
                  variant="outline" 
                  className="bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
                >
                  +£50m to All
                </Button>
                <Button 
                  onClick={exportTeams} 
                  variant="outline" 
                  className="bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
                >
                  📊 Export Teams CSV
                </Button>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Username</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Budget (£m)</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map(u => (
                  <TableRow key={u.id}>
                    <TableCell>
                      {editingId === u.id ? (
                        <Input defaultValue={u.username} onBlur={e => updateUser(u.id, { username: e.target.value })} />
                      ) : (
                        u.username
                      )}
                    </TableCell>
                    <TableCell>
                      {editingId === u.id ? (
                        <Input defaultValue={u.name} onBlur={e => updateUser(u.id, { name: e.target.value })} />
                      ) : (
                        u.name
                      )}
                    </TableCell>
                    <TableCell>
                      {editingId === u.id ? (
                        <Input type="number" defaultValue={u.budgetKGBP} onBlur={e => updateUser(u.id, { budgetKGBP: Number(e.target.value) })} />
                      ) : (
                        `£${(u.budgetKGBP / 1000).toFixed(1)}m`
                      )}
                    </TableCell>
                    <TableCell className="space-x-2">
                      <Button variant="outline" size="sm" onClick={() => setEditingId(editingId === u.id ? null : u.id)}>
                        {editingId === u.id ? 'Done' : 'Edit'}
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => resetPassword(u.id)}>
                        Reset Password
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => deleteUser(u.id)}>Delete</Button>
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


