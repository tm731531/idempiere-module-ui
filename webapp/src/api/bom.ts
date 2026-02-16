import { apiClient } from './client'

/**
 * Get BOM header(s) for a product.
 */
export async function getBOMsForProduct(productId: number): Promise<any[]> {
  const resp = await apiClient.get('/api/v1/models/PP_Product_BOM', {
    params: {
      '$filter': `M_Product_ID eq ${productId} and IsActive eq true`,
      '$orderby': 'PP_Product_BOM_ID',
      '_t': Date.now(),
    },
  })
  return resp.data.records || []
}

/**
 * Create a BOM header for a product.
 */
export async function createBOM(data: {
  M_Product_ID: number
  Value: string
  Name: string
  BOMType?: string
  BOMUse?: string
}): Promise<any> {
  const resp = await apiClient.post('/api/v1/models/PP_Product_BOM', {
    M_Product_ID: data.M_Product_ID,
    Value: data.Value,
    Name: data.Name,
    BOMType: data.BOMType || 'A',
    BOMUse: data.BOMUse || 'A',
  })
  return resp.data
}

/**
 * Get all BOM lines for a BOM header.
 */
export async function getBOMLines(bomId: number): Promise<any[]> {
  const resp = await apiClient.get('/api/v1/models/PP_Product_BOMLine', {
    params: {
      '$filter': `PP_Product_BOM_ID eq ${bomId}`,
      '$expand': 'M_Product_ID,C_UOM_ID',
      '$orderby': 'Line',
      '_t': Date.now(),
    },
  })
  return resp.data.records || []
}

/**
 * Add a BOM line.
 */
export async function addBOMLine(data: {
  PP_Product_BOM_ID: number
  M_Product_ID: number
  Line: number
  QtyBOM?: number
  ComponentType?: string
}): Promise<any> {
  const payload: Record<string, any> = {
    PP_Product_BOM_ID: data.PP_Product_BOM_ID,
    M_Product_ID: data.M_Product_ID,
    Line: data.Line,
    QtyBOM: data.QtyBOM ?? 1,
  }
  if (data.ComponentType) payload.ComponentType = data.ComponentType
  const resp = await apiClient.post('/api/v1/models/PP_Product_BOMLine', payload)
  return resp.data
}

/**
 * Update a BOM line.
 */
export async function updateBOMLine(lineId: number, data: Record<string, any>): Promise<any> {
  const resp = await apiClient.put(`/api/v1/models/PP_Product_BOMLine/${lineId}`, data)
  return resp.data
}

/**
 * Delete a BOM line.
 */
export async function deleteBOMLine(lineId: number): Promise<void> {
  await apiClient.delete(`/api/v1/models/PP_Product_BOMLine/${lineId}`)
}

// Cache for process slug lookup
let verifyProcessSlug: string | null | undefined

/**
 * Lookup the Verify BOM process slug dynamically.
 * REST /api/v1/processes/{slug} uses lowercase Value as slug.
 */
export async function lookupVerifyBOMProcessSlug(): Promise<string | null> {
  if (verifyProcessSlug !== undefined) return verifyProcessSlug
  try {
    const resp = await apiClient.get('/api/v1/models/AD_Process', {
      params: {
        '$filter': "Value eq 'PP_Product_BOM' and IsActive eq true",
        '$select': 'AD_Process_ID,Value',
        '$top': '1',
      },
    })
    const records = resp.data.records || []
    const value: string | undefined = records[0]?.Value
    const result = value ? value.toLowerCase() : null
    verifyProcessSlug = result
    return result
  } catch {
    verifyProcessSlug = null
    return null
  }
}

// Cache for M_Product table ID lookup
let productTableId: number | null | undefined

/**
 * Lookup M_Product table ID dynamically (never hardcode).
 */
async function lookupProductTableId(): Promise<number | null> {
  if (productTableId !== undefined) return productTableId
  try {
    const resp = await apiClient.get('/api/v1/models/AD_Table', {
      params: {
        '$filter': "TableName eq 'M_Product'",
        '$select': 'AD_Table_ID',
        '$top': '1',
      },
    })
    const records = resp.data.records || []
    const result: number | null = records[0]?.id || null
    productTableId = result
    return result
  } catch {
    productTableId = null
    return null
  }
}

/**
 * Run the Verify BOM process for a product.
 * Process endpoint: /api/v1/processes/{slug} where slug = lowercase Value.
 */
export async function verifyBOM(productId: number): Promise<{ summary: string; isError: boolean }> {
  const [slug, tableId] = await Promise.all([
    lookupVerifyBOMProcessSlug(),
    lookupProductTableId(),
  ])
  if (!slug) throw new Error('找不到 BOM 驗證程序')
  if (!tableId) throw new Error('找不到 M_Product 資料表')

  const resp = await apiClient.post(`/api/v1/processes/${slug}`, {
    'record-id': productId,
    'table-id': tableId,
  })
  return {
    summary: resp.data?.summary || '',
    isError: resp.data?.isError ?? false,
  }
}
