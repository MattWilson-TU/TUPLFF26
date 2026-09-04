import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import {
  buildAuctionLogXlsx,
  getAuctionLogRows,
  resolveAuctionId,
  syncAuctionLogToSheet,
} from '@/lib/auction-log'

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.username || session.user.username !== 'Admin01') {
    return null
  }
  return session
}

function getSheetUrl(): string | null {
  if (process.env.NEXT_PUBLIC_AUCTION_LOG_SHEET_URL) {
    return process.env.NEXT_PUBLIC_AUCTION_LOG_SHEET_URL
  }
  if (process.env.AUCTION_LOG_SHEET_URL) {
    return process.env.AUCTION_LOG_SHEET_URL
  }
  const id = process.env.AUCTION_LOG_SHEET_ID
  if (id) {
    return `https://docs.google.com/spreadsheets/d/${id}/edit`
  }
  return null
}

/**
 * GET /api/admin/auction-log?format=xlsx|json
 * Returns the auction log as .xlsx download or JSON for debugging.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAdmin()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const format = request.nextUrl.searchParams.get('format') || 'xlsx'
    const auctionIdParam = request.nextUrl.searchParams.get('auctionId')
    const auctionId = await resolveAuctionId(auctionIdParam)

    if (!auctionId) {
      return NextResponse.json({ error: 'No auction found' }, { status: 404 })
    }

    const rows = await getAuctionLogRows(auctionId)

    if (format === 'json') {
      return NextResponse.json({
        auctionId,
        rows,
        count: rows.length,
        sheetConfigured: Boolean(process.env.AUCTION_LOG_SHEET_ID),
        sheetUrl: getSheetUrl(),
      })
    }

    const buffer = await buildAuctionLogXlsx(rows)
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="auction-log.xlsx"',
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('Error exporting auction log:', error)
    return NextResponse.json(
      { error: 'Failed to export auction log' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/auction-log
 * Force a resync of the Google Sheet from current DB state.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAdmin()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let auctionIdParam: string | null = null
    try {
      const body = await request.json()
      auctionIdParam = body?.auctionId ?? null
    } catch {
      // empty body is fine
    }

    const auctionId = await resolveAuctionId(auctionIdParam)
    if (!auctionId) {
      return NextResponse.json({ error: 'No auction found' }, { status: 404 })
    }

    const result = await syncAuctionLogToSheet(auctionId)
    return NextResponse.json({
      ...result,
      auctionId,
      sheetUrl: getSheetUrl(),
    })
  } catch (error) {
    console.error('Error resyncing auction log:', error)
    return NextResponse.json(
      { error: 'Failed to resync auction log' },
      { status: 500 }
    )
  }
}
