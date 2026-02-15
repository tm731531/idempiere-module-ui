import { apiClient } from './client'

export async function listProducts(filter?: string): Promise<any[]> {
  const params: Record<string, string> = {
    '$select': 'M_Product_ID,Value,Name,ProductType,IsBOM,IsVerified,IsActive,C_UOM_ID,M_Product_Category_ID',
    '$expand': 'C_UOM_ID,M_Product_Category_ID',
    '$orderby': 'Name',
    '$top': '200',
  }
  if (filter) params['$filter'] = filter
  const resp = await apiClient.get('/api/v1/models/M_Product', { params })
  return resp.data.records || []
}

export async function getProduct(id: number): Promise<any> {
  const resp = await apiClient.get(`/api/v1/models/M_Product/${id}`)
  return resp.data
}

export async function updateProduct(id: number, data: Record<string, any>): Promise<any> {
  const resp = await apiClient.put(`/api/v1/models/M_Product/${id}`, data)
  return resp.data
}
