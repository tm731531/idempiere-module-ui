import { apiClient } from './client'
import { toIdempiereDateTime } from './utils'

export interface ProductionData {
  M_Product_ID: number
  ProductionQty: number
  MovementDate: Date
  AD_Org_ID: number
  M_Locator_ID?: number
  Description?: string
}

export interface ProductionLineData {
  M_Product_ID: number
  MovementQty: number
  Description?: string
}

export async function listProductions(filter?: string): Promise<any[]> {
  const params: Record<string, string> = {
    '$select': 'M_Production_ID,DocumentNo,DocStatus,M_Product_ID,ProductionQty,MovementDate,Description',
    '$expand': 'M_Product_ID',
    '$orderby': 'MovementDate desc',
    '$top': '100',
  }
  if (filter) params['$filter'] = filter
  const resp = await apiClient.get('/api/v1/models/M_Production', { params })
  return resp.data.records || []
}

export async function getProduction(id: number): Promise<any> {
  const resp = await apiClient.get(`/api/v1/models/M_Production/${id}`, {
    params: { '$expand': 'M_Product_ID' },
  })
  return resp.data
}

export async function createProduction(data: ProductionData): Promise<any> {
  const resp = await apiClient.post('/api/v1/models/M_Production', {
    AD_Org_ID: data.AD_Org_ID,
    M_Product_ID: data.M_Product_ID,
    ProductionQty: data.ProductionQty,
    MovementDate: toIdempiereDateTime(data.MovementDate),
    M_Locator_ID: data.M_Locator_ID || undefined,
    Description: data.Description || '',
  })
  return resp.data
}

export async function getProductionLines(productionId: number): Promise<any[]> {
  const resp = await apiClient.get('/api/v1/models/M_ProductionLine', {
    params: {
      '$filter': `M_Production_ID eq ${productionId}`,
      '$expand': 'M_Product_ID',
      '$orderby': 'Line',
    },
  })
  return resp.data.records || []
}

export async function addProductionLine(productionId: number, data: ProductionLineData): Promise<any> {
  const resp = await apiClient.post('/api/v1/models/M_ProductionLine', {
    M_Production_ID: productionId,
    M_Product_ID: data.M_Product_ID,
    MovementQty: data.MovementQty,
    Description: data.Description || '',
  })
  return resp.data
}

export async function deleteProductionLine(lineId: number): Promise<void> {
  await apiClient.delete(`/api/v1/models/M_ProductionLine/${lineId}`)
}
