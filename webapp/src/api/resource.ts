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
