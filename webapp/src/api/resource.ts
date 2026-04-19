import { apiClient } from './client'

export interface Resource {
  id: number
  Name: string
  IsActive: boolean
  resourceTypeId: number | null
}

export interface ResourceType {
  id: number
  Name: string
}

export async function listResources(): Promise<Resource[]> {
  const resp = await apiClient.get('/api/v1/models/S_Resource', {
    params: {
      '$select': 'S_Resource_ID,Name,IsActive,S_ResourceType_ID',
      '$filter': 'IsActive eq true',
      '$orderby': 'Name',
    },
  })
  return (resp.data.records || []).map((r: any) => ({
    id: r.id,
    Name: r.Name,
    IsActive: r.IsActive,
    resourceTypeId: typeof r.S_ResourceType_ID === 'object'
      ? (r.S_ResourceType_ID?.id ?? null)
      : (r.S_ResourceType_ID ?? null),
  }))
}

export async function listResourceTypes(): Promise<ResourceType[]> {
  const resp = await apiClient.get('/api/v1/models/S_ResourceType', {
    params: {
      '$select': 'S_ResourceType_ID,Name',
      '$filter': 'IsActive eq true',
      '$orderby': 'Name',
    },
  })
  return (resp.data.records || []).map((r: any) => ({
    id: r.id ?? r.S_ResourceType_ID,
    Name: r.Name,
  }))
}

export async function deactivateResource(id: number): Promise<void> {
  await apiClient.put(`/api/v1/models/S_Resource/${id}`, { IsActive: false })
}

/**
 * Create a new S_Resource.
 * Mandatory: Name, Value, S_ResourceType_ID, M_Warehouse_ID.
 */
export async function createResource(data: {
  name: string
  warehouseId: number
}): Promise<Resource> {
  // Lookup first active S_ResourceType dynamically
  const typeResp = await apiClient.get('/api/v1/models/S_ResourceType', {
    params: {
      '$filter': 'IsActive eq true',
      '$select': 'S_ResourceType_ID,Name',
      '$orderby': 'Name asc',
      '$top': '1',
    },
  })
  const types = typeResp.data.records || []
  if (types.length === 0) throw new Error('找不到資源類型')

  const resp = await apiClient.post('/api/v1/models/S_Resource', {
    Name: data.name,
    Value: data.name,
    S_ResourceType_ID: types[0].id,
    M_Warehouse_ID: data.warehouseId,
    IsAvailable: true,
    PercentUtilization: 100,
  })
  return {
    id: resp.data.id,
    Name: resp.data.Name || data.name,
    IsActive: true,
    resourceTypeId: types[0].id ?? null,
  }
}

export interface ResourceUnavailability {
  id: number
  resourceId: number
  dateFrom: string   // YYYY-MM-DD
  dateTo: string | null
  name: string
}

/**
 * Fetch S_ResourceUnAvailable records for given resources and date range.
 * Displayed as grey background blocks on the calendar.
 * Returns [] on any error (non-fatal — calendar still works).
 */
export async function listResourceUnavailability(
  resourceIds: number[],
  dateFrom: Date,
  dateTo: Date,
): Promise<ResourceUnavailability[]> {
  if (resourceIds.length === 0) return []

  const fromStr = dateFrom.toISOString().slice(0, 10)
  const toStr = dateTo.toISOString().slice(0, 10)

  const idList = resourceIds.join(',')
  const filter = `S_Resource_ID in (${idList}) and DateFrom le '${toStr}T23:59:59Z'`

  try {
    const resp = await apiClient.get('/api/v1/models/S_ResourceUnAvailable', {
      params: {
        '$filter': filter,
        '$select': 'S_ResourceUnAvailable_ID,S_Resource_ID,DateFrom,DateTo,Name',
        '$top': '200',
      },
    })
    const records: any[] = resp.data?.records ?? []
    return records
      .filter(r => {
        const endDate = r.DateTo ? r.DateTo.slice(0, 10) : r.DateFrom.slice(0, 10)
        return endDate >= fromStr
      })
      .map(r => ({
        id: r.id ?? r.S_ResourceUnAvailable_ID,
        resourceId: typeof r.S_Resource_ID === 'object' ? (r.S_Resource_ID.id ?? 0) : (r.S_Resource_ID ?? 0),
        dateFrom: r.DateFrom ? r.DateFrom.slice(0, 10) : fromStr,
        dateTo: r.DateTo ? r.DateTo.slice(0, 10) : null,
        name: String(r.Name ?? '不可用'),
      }))
  } catch {
    return []
  }
}
