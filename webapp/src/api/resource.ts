import { apiClient } from './client'

export async function listResources(): Promise<any[]> {
  const resp = await apiClient.get('/api/v1/models/S_Resource', {
    params: {
      '$select': 'S_Resource_ID,Name,IsActive',
      '$filter': 'IsActive eq true',
      '$orderby': 'Name',
    },
  })
  return resp.data.records || []
}
