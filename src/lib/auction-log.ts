import { google } from 'googleapis'
import ExcelJS from 'exceljs'
import { prisma } from '@/lib/prisma'

export type AuctionLogRow = {
  id: number
  firstName: string
  surname: string
  webName: string
  position: string
  feeM: number
  manager: string
}

const LOT_ORDER = [
  { player: { elementType: 'asc' as const } },
  { player: { nowCostHalfM: 'desc' as const } },
  { player: { firstName: 'asc' as const } },
  { player: { secondName: 'asc' as const } },
]

const HEADERS = [
  'ID',
  'First Name',
  'Surname',
  'Web Name',
  'Position',
  'Fee (£m)',
  'Manager',
] as const

/**
 * Read-only query of finalised (sold or unsold) lots for an auction,
 * ordered the same way the auction advances lots.
 */
export async function getAuctionLogRows(auctionId: string): Promise<AuctionLogRow[]> {
  const lots = await prisma.auctionLot.findMany({
    where: { auctionId, isSold: true },
    include: {
      player: {
        select: {
          id: true,
          firstName: true,
          secondName: true,
          webName: true,
          elementType: true,
        },
      },
      winner: {
        select: { username: true },
      },
    },
    orderBy: LOT_ORDER,
  })

  return lots.map((lot) => ({
    id: lot.player.id,
    firstName: lot.player.firstName,
    surname: lot.player.secondName,
    webName: lot.player.webName ?? '',
    position: lot.player.elementType,
    feeM: (lot.soldPriceHalfM ?? 0) / 2,
    manager: lot.winner?.username ?? 'UNSOLD',
  }))
}

function rowsToValues(rows: AuctionLogRow[]): (string | number)[][] {
  return [
    [...HEADERS],
    ...rows.map((r) => [
      r.id,
      r.firstName,
      r.surname,
      r.webName,
      r.position,
      Number(r.feeM.toFixed(1)),
      r.manager,
    ]),
  ]
}

function getSheetsAuth() {
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (json) {
    const credentials = JSON.parse(json)
    return new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    })
  }
  // Cloud Run / GCP: Application Default Credentials
  return new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
}

export type SyncResult = {
  ok: boolean
  rows: number
  skipped?: boolean
  error?: string
}

/**
 * Full rebuild of the auction log Google Sheet. Safe to call repeatedly.
 * Never throws — failures are logged and returned so auction mechanics are unaffected.
 */
export async function syncAuctionLogToSheet(auctionId: string): Promise<SyncResult> {
  const sheetId = process.env.AUCTION_LOG_SHEET_ID
  if (!sheetId) {
    console.log('[auction-log] AUCTION_LOG_SHEET_ID unset; skipping sheet sync')
    return { ok: true, rows: 0, skipped: true }
  }

  const tab = process.env.AUCTION_LOG_SHEET_TAB || 'Auction Log'

  try {
    const rows = await getAuctionLogRows(auctionId)
    const values = rowsToValues(rows)

    const auth = getSheetsAuth()
    const sheets = google.sheets({ version: 'v4', auth })

    // Clear existing content, then write header + all finalised rows
    await sheets.spreadsheets.values.clear({
      spreadsheetId: sheetId,
      range: `'${tab}'`,
    })

    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `'${tab}'!A1`,
      valueInputOption: 'RAW',
      requestBody: { values },
    })

    console.log(`[auction-log] Synced ${rows.length} rows to sheet ${sheetId}`)
    return { ok: true, rows: rows.length }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[auction-log] Failed to sync sheet:', message)
    return { ok: false, rows: 0, error: message }
  }
}

/**
 * Build an .xlsx buffer of the auction log for download.
 */
export async function buildAuctionLogXlsx(rows: AuctionLogRow[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'FPL Auction'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet('Auction Log', {
    views: [{ state: 'frozen', ySplit: 1 }],
  })

  sheet.columns = [
    { header: 'ID', key: 'id', width: 10 },
    { header: 'First Name', key: 'firstName', width: 16 },
    { header: 'Surname', key: 'surname', width: 16 },
    { header: 'Web Name', key: 'webName', width: 16 },
    { header: 'Position', key: 'position', width: 10 },
    { header: 'Fee (£m)', key: 'feeM', width: 12 },
    { header: 'Manager', key: 'manager', width: 16 },
  ]

  const headerRow = sheet.getRow(1)
  headerRow.font = { bold: true }
  headerRow.alignment = { vertical: 'middle' }

  for (const row of rows) {
    sheet.addRow({
      id: row.id,
      firstName: row.firstName,
      surname: row.surname,
      webName: row.webName,
      position: row.position,
      feeM: Number(row.feeM.toFixed(1)),
      manager: row.manager,
    })
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(arrayBuffer)
}

/**
 * Resolve the current (OPEN) auction, falling back to the most recently updated auction.
 */
export async function resolveAuctionId(preferredId?: string | null): Promise<string | null> {
  if (preferredId) return preferredId

  const open = await prisma.auction.findFirst({
    where: { status: 'OPEN' },
    orderBy: { updatedAt: 'desc' },
    select: { id: true },
  })
  if (open) return open.id

  const any = await prisma.auction.findFirst({
    orderBy: { updatedAt: 'desc' },
    select: { id: true },
  })
  return any?.id ?? null
}
