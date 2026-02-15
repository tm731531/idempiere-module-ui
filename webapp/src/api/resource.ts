import { apiClient } from './client'

export interface Resource {
  id: number
  Name: string
  IsActive: boolean
}

export async function listResources(): Promise<Resource[]> {
  const resp = await apiClient.get('/api/v1/models/S_Resource', {
    params: {
      '$select': 'S_Resource_ID,Name,IsActive',
      '$filter': 'IsActive eq true',
      '$orderby': 'Name',
    },
  })
  return (resp.data.records || []).map((r: any) => ({
    id: r.id,
    Name: r.Name,
    IsActive: r.IsActive,
  }))
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
  }
}
