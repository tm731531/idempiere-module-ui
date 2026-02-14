import { apiClient } from './client'
import { toIdempiereDateTime } from './utils'

export interface AssignmentData {
  S_Resource_ID: number
  AssignDateFrom: string  // ISO datetime
  AssignDateTo: string    // ISO datetime
  Name: string
  Description?: string
  AD_Org_ID: number
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
  const payload = {
    ...data,
    AssignDateFrom: toIdempiereDateTime(new Date(data.AssignDateFrom)),
    AssignDateTo: toIdempiereDateTime(new Date(data.AssignDateTo)),
  }
  const resp = await apiClient.post('/api/v1/models/S_ResourceAssignment', payload)
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

export async function checkConflict(
  resourceId: number,
  dateFrom: Date,
  dateTo: Date,
  excludeId?: number,
): Promise<boolean> {
  // Check for overlapping assignments for the same resource
  let filter = `S_Resource_ID eq ${resourceId} and AssignDateFrom lt '${toIdempiereDateTime(dateTo)}' and AssignDateTo gt '${toIdempiereDateTime(dateFrom)}'`
  if (excludeId) filter += ` and S_ResourceAssignment_ID ne ${excludeId}`

  const resp = await apiClient.get('/api/v1/models/S_ResourceAssignment', {
    params: { '$filter': filter, '$top': '1' },
  })
  return (resp.data.records || []).length > 0
}
