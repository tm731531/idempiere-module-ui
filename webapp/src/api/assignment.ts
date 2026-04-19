import { apiClient } from './client'
import { toIdempiereDateTime } from './utils'
import { parseDesc, serializeDesc } from '@/composables/useAppointmentDesc'
import { isTerminalStatus } from '@/composables/useAppointmentStatuses'

export interface AssignmentData {
  S_Resource_ID: number
  AssignDateFrom: string  // ISO datetime
  AssignDateTo: string    // ISO datetime
  Name: string
  Description?: string
  AD_Org_ID: number
  // C_BPartner_ID is NOT a standard S_ResourceAssignment column — do not include in payload
}

export async function listAssignments(
  dateFrom: Date,
  dateTo: Date,
  resourceId?: number,
): Promise<any[]> {
  // Use AssignDateFrom for both bounds — mixing AssignDateFrom/AssignDateTo
  // in filter causes incorrect results due to iDempiere UTC conversion mismatch
  const nextDay = new Date(dateTo)
  nextDay.setDate(nextDay.getDate() + 1)
  nextDay.setHours(0, 0, 0, 0)
  let filter = `AssignDateFrom ge '${toIdempiereDateTime(dateFrom)}' and AssignDateFrom lt '${toIdempiereDateTime(nextDay)}'`
  if (resourceId) filter += ` and S_Resource_ID eq ${resourceId}`

  const resp = await apiClient.get('/api/v1/models/S_ResourceAssignment', {
    params: {
      '$filter': filter,
      '$expand': 'S_Resource_ID',
      '$orderby': 'AssignDateFrom',
      '$top': '500',
    },
  })
  return resp.data.records || []
}

export async function createAssignment(data: AssignmentData): Promise<any> {
  // AssignDateFrom/To should already be in iDempiere format (fake-Z format)
  // from the caller (CopyDialog uses toIdempiereDateTime already)
  const resp = await apiClient.post('/api/v1/models/S_ResourceAssignment', data)
  return resp.data
}

export async function updateAssignment(id: number, data: Record<string, any>): Promise<any> {
  // Never include IsConfirmed — it's not updateable
  const { IsConfirmed, ...safeData } = data
  const resp = await apiClient.put(`/api/v1/models/S_ResourceAssignment/${id}`, safeData)
  return resp.data
}

export async function deleteAssignment(id: number): Promise<void> {
  await apiClient.delete(`/api/v1/models/S_ResourceAssignment/${id}`)
}

/**
 * Cancel an assignment by setting its status to CXL in Description JSON.
 * The record is retained in the database; only the status changes.
 * Conflict detection will exclude CXL/ABS records after this call.
 *
 * @param id - S_ResourceAssignment_ID
 * @param currentDesc - current raw Description string (will be merged)
 */
export async function cancelAssignment(id: number, currentDesc: string): Promise<void> {
  const desc = parseDesc(currentDesc)
  desc.status = 'CXL'
  await apiClient.put(`/api/v1/models/S_ResourceAssignment/${id}`, {
    Description: serializeDesc(desc),
  })
}

/**
 * List assignments for a specific customer.
 * S_ResourceAssignment has no C_BPartner_ID column in standard iDempiere —
 * filter by Name containing the customer ID as a fallback, or return empty.
 */
export async function listAssignmentsByCustomer(
  _customerId: number,
  _top = 10,
): Promise<any[]> {
  // S_ResourceAssignment does not have C_BPartner_ID in standard iDempiere.
  // Return empty so the sidebar shows "尚無預約記錄" rather than an error.
  return []
}

export interface MultiAssignmentResult {
  resourceId: number
  result?: any
  error?: Error
}

/**
 * Create one assignment per resource in parallel.
 * Uses Promise.allSettled so partial failures do not abort the whole batch.
 * Returns per-resource outcome (success or error).
 */
export async function createMultipleAssignments(
  payload: Omit<AssignmentData, 'S_Resource_ID'>,
  resourceIds: number[],
): Promise<MultiAssignmentResult[]> {
  const results = await Promise.allSettled(
    resourceIds.map((resourceId) =>
      createAssignment({ ...payload, S_Resource_ID: resourceId }),
    ),
  )
  return results.map((r, i) => {
    const resourceId = resourceIds[i]!
    if (r.status === 'fulfilled') {
      return { resourceId, result: r.value }
    } else {
      return { resourceId, error: r.reason as Error }
    }
  })
}

export async function checkConflict(
  resourceId: number,
  dateFrom: Date,
  dateTo: Date,
  excludeId?: number,
): Promise<boolean> {
  // Check for overlapping assignments for the same resource.
  // Fetch a small batch so we can filter terminal statuses (CXL/ABS) client-side
  // — iDempiere OData cannot filter on JSON embedded in the Description field.
  const fromStr = toIdempiereDateTime(dateFrom)
  const toStr = toIdempiereDateTime(dateTo)
  let filter = `S_Resource_ID eq ${resourceId} and AssignDateFrom lt '${toStr}' and AssignDateTo gt '${fromStr}'`
  if (excludeId) filter += ` and S_ResourceAssignment_ID neq ${excludeId}`

  const resp = await apiClient.get('/api/v1/models/S_ResourceAssignment', {
    params: { '$filter': filter, '$select': 'Description', '$top': '50' },
  })
  const records: any[] = resp.data.records || []
  // Exclude terminal-status records (CXL / ABS) from conflict consideration
  const active = records.filter((r) => {
    const status = parseDesc(r.Description)?.status ?? ''
    return !isTerminalStatus(status)
  })
  return active.length > 0
}
