import { apiClient } from './client'
import { escapeODataString } from './utils'

export interface AdNote {
  id: number
  AD_Note_ID?: number
  AD_Table_ID: number | { id: number; identifier: string }
  Record_ID: number
  Description: string   // short field — used to store activity type (CALL | EMAIL | MEETING | NOTE)
  TextMsg: string       // long text field — stores activity content or JSON for call logs
  Created: string
  CreatedBy: number | { id: number; identifier: string }
  Updated?: string
}

export type ActivityType = 'CALL' | 'EMAIL' | 'MEETING' | 'NOTE'

export interface CreateNotePayload {
  AD_Table_ID: number
  Record_ID: number
  Description: string   // activity type label
  TextMsg: string       // activity content or JSON
  AD_Org_ID?: number
}

// Cache the AD_Table_ID for R_Request so we only query once per session
let cachedRRequestTableId: number | null = null

/**
 * Look up AD_Table_ID for R_Request dynamically.
 * Result is cached in memory for the session lifetime.
 * Follows the Iron Rule: never hardcode IDs.
 */
export async function getRRequestTableId(): Promise<number> {
  if (cachedRRequestTableId !== null) {
    return cachedRRequestTableId
  }

  const tableName = 'R_Request'
  const escaped = escapeODataString(tableName)
  const resp = await apiClient.get('/api/v1/models/AD_Table', {
    params: {
      '$filter': `TableName eq '${escaped}' and IsActive eq true`,
      '$select': 'AD_Table_ID,TableName',
      '$top': 1,
    },
  })
  const records = resp.data?.records || []
  if (records.length === 0) {
    throw new Error(`AD_Table not found for TableName=${tableName}`)
  }

  // iDempiere REST returns the primary key as `id` on every record
  const tableId: number = records[0].id
  cachedRRequestTableId = tableId
  return tableId
}

/** Reset the table ID cache (called on logout / test teardown) */
export function clearAdNoteCache(): void {
  cachedRRequestTableId = null
}

/**
 * List AD_Note records for a specific table + record.
 * Returns newest-first order.
 */
export async function listNotesForRecord(
  tableName: string,
  recordId: number,
): Promise<AdNote[]> {
  // Resolve the table ID first
  let tableId: number
  if (tableName === 'R_Request') {
    tableId = await getRRequestTableId()
  } else {
    // Generic lookup (not cached, used for other tables if ever needed)
    const escaped = escapeODataString(tableName)
    const resp = await apiClient.get('/api/v1/models/AD_Table', {
      params: {
        '$filter': `TableName eq '${escaped}' and IsActive eq true`,
        '$select': 'AD_Table_ID,TableName',
        '$top': 1,
      },
    })
    const records = resp.data?.records || []
    if (records.length === 0) throw new Error(`AD_Table not found: ${tableName}`)
    tableId = records[0].id
  }

  const resp = await apiClient.get('/api/v1/models/AD_Note', {
    params: {
      '$filter': `AD_Table_ID eq ${tableId} and Record_ID eq ${recordId} and IsActive eq true`,
      '$select': 'AD_Note_ID,AD_Table_ID,Record_ID,Description,TextMsg,Created,CreatedBy',
      '$orderby': 'Created desc',
      '$top': 200,
    },
  })
  return (resp.data?.records || []).map((r: any) => ({
    id: r.id,
    AD_Note_ID: r.AD_Note_ID,
    AD_Table_ID: r.AD_Table_ID,
    Record_ID: r.Record_ID,
    Description: r.Description || '',
    TextMsg: r.TextMsg || '',
    Created: r.Created || '',
    CreatedBy: r.CreatedBy || 0,
  }))
}

/**
 * Create a new AD_Note record.
 */
export async function createNote(payload: CreateNotePayload): Promise<AdNote> {
  const resp = await apiClient.post('/api/v1/models/AD_Note', payload)
  const r = resp.data
  return {
    id: r.id,
    AD_Note_ID: r.AD_Note_ID,
    AD_Table_ID: r.AD_Table_ID,
    Record_ID: r.Record_ID,
    Description: r.Description || '',
    TextMsg: r.TextMsg || '',
    Created: r.Created || '',
    CreatedBy: r.CreatedBy || 0,
  }
}
