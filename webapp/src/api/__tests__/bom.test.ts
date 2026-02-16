import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiClient } from '@/api/client'

vi.mock('@/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    defaults: { headers: { common: {} } },
  },
}))

describe('bom API', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it('getBOMsForProduct filters by product ID', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: { records: [{ id: 100, Value: 'BOM-001', Name: 'Test BOM' }] },
    })
    const { getBOMsForProduct } = await import('@/api/bom')
    const results = await getBOMsForProduct(145)
    expect(results).toHaveLength(1)
    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/v1/models/PP_Product_BOM',
      expect.objectContaining({
        params: expect.objectContaining({
          '$filter': 'M_Product_ID eq 145 and IsActive eq true',
        }),
      }),
    )
  })

  it('createBOM posts with defaults BOMType=A, BOMUse=A', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      data: { id: 100, Value: 'BOM-001', Name: 'Test' },
    })
    const { createBOM } = await import('@/api/bom')
    const result = await createBOM({
      M_Product_ID: 145,
      Value: 'BOM-001',
      Name: 'Test BOM',
    })
    expect(result.id).toBe(100)
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/models/PP_Product_BOM',
      expect.objectContaining({
        M_Product_ID: 145,
        BOMType: 'A',
        BOMUse: 'A',
      }),
    )
  })

  it('getBOMLines expands M_Product_ID and C_UOM_ID', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: { records: [{ id: 10, Line: 10 }, { id: 20, Line: 20 }] },
    })
    const { getBOMLines } = await import('@/api/bom')
    const lines = await getBOMLines(100)
    expect(lines).toHaveLength(2)
    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/v1/models/PP_Product_BOMLine',
      expect.objectContaining({
        params: expect.objectContaining({
          '$filter': 'PP_Product_BOM_ID eq 100',
          '$expand': 'M_Product_ID,C_UOM_ID',
        }),
      }),
    )
  })

  it('addBOMLine posts with required fields', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { id: 10 } })
    const { addBOMLine } = await import('@/api/bom')
    await addBOMLine({
      PP_Product_BOM_ID: 100,
      M_Product_ID: 50,
      Line: 10,
      QtyBOM: 4,
      ComponentType: 'CO',
    })
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/models/PP_Product_BOMLine',
      expect.objectContaining({
        PP_Product_BOM_ID: 100,
        M_Product_ID: 50,
        QtyBOM: 4,
        Line: 10,
      }),
    )
  })

  it('addBOMLine defaults QtyBOM to 1', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { id: 10 } })
    const { addBOMLine } = await import('@/api/bom')
    await addBOMLine({
      PP_Product_BOM_ID: 100,
      M_Product_ID: 50,
      Line: 10,
    })
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/models/PP_Product_BOMLine',
      expect.objectContaining({ QtyBOM: 1 }),
    )
  })

  it('updateBOMLine puts to correct endpoint', async () => {
    vi.mocked(apiClient.put).mockResolvedValue({ data: { id: 10 } })
    const { updateBOMLine } = await import('@/api/bom')
    await updateBOMLine(10, { QtyBOM: 5 })
    expect(apiClient.put).toHaveBeenCalledWith(
      '/api/v1/models/PP_Product_BOMLine/10',
      { QtyBOM: 5 },
    )
  })

  it('deleteBOMLine calls delete endpoint', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({ data: {} })
    const { deleteBOMLine } = await import('@/api/bom')
    await deleteBOMLine(10)
    expect(apiClient.delete).toHaveBeenCalledWith('/api/v1/models/PP_Product_BOMLine/10')
  })

  it('lookupVerifyBOMProcessSlug returns lowercase Value', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: { records: [{ id: 136, Value: 'PP_Product_BOM' }] },
    })
    const { lookupVerifyBOMProcessSlug } = await import('@/api/bom')
    const slug = await lookupVerifyBOMProcessSlug()
    expect(slug).toBe('pp_product_bom')
    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/v1/models/AD_Process',
      expect.objectContaining({
        params: expect.objectContaining({
          '$filter': expect.stringContaining("Value eq 'PP_Product_BOM'"),
        }),
      }),
    )
  })
})
