import { apiClient } from './client'
import { toIdempiereDateTime } from './utils'

export interface AssignmentData {
  S_Resource_ID: number
  AssignDateFrom: string  // ISO datetime
  AssignDateTo: string    // ISO datetime
  Name: string
  Description?: string
  AD_Org_ID: number
  C_BPartner_ID?: number | null  // Customer (optional)
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
      '$expand': 'S_Resource_ID,C_BPartner_ID',
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
 * List assignments for a specific customer (C_BPartner_ID), ordered by
 * AssignDateFrom DESC. Used by CustomerHistorySidebar.
 */
export async function listAssignmentsByCustomer(
  customerId: number,
  top = 10,
): Promise<any[]> {
  const resp = await apiClient.get('/api/v1/models/S_ResourceAssignment', {
    params: {
      '$filter': `C_BPartner_ID eq ${customerId}`,
      '$expand': 'S_Resource_ID,C_BPartner_ID',
      '$orderby': 'AssignDateFrom desc',
      '$top': String(top),
    },
  })
  return resp.data.records || []
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
  // Check for overlapping assignments for the same resource
  const fromStr = toIdempiereDateTime(dateFrom)
  const toStr = toIdempiereDateTime(dateTo)
  let filter = `S_Resource_ID eq ${resourceId} and AssignDateFrom lt '${toStr}' and AssignDateTo gt '${fromStr}'`
  if (excludeId) filter += ` and S_ResourceAssignment_ID neq ${excludeId}`

  const resp = await apiClient.get('/api/v1/models/S_ResourceAssignment', {
    params: { '$filter': filter, '$top': '1' },
  })
  return (resp.data.records || []).length > 0
}
