import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiClient } from '@/api/client'

vi.mock('@/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
    defaults: { headers: { common: {} } },
  },
}))

describe('production API', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('listProductions fetches with expand', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { records: [{ id: 1 }] } })
    const { listProductions } = await import('@/api/production')
    const results = await listProductions()
    expect(results).toHaveLength(1)
  })

  it('createProduction formats date correctly', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { id: 1 } })
    const { createProduction } = await import('@/api/production')
    await createProduction({
      M_Product_ID: 5,
      ProductionQty: 1,
      MovementDate: new Date('2026-02-14T10:00:00'),
      AD_Org_ID: 11,
    })
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/models/M_Production', expect.objectContaining({
      M_Product_ID: 5,
      ProductionQty: 1,
    }))
    // Verify date doesn't have milliseconds
    const postedData = vi.mocked(apiClient.post).mock.calls[0][1] as any
    expect(postedData.MovementDate).not.toContain('.')
  })

  it('addProductionLine posts to M_ProductionLine', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { id: 10 } })
    const { addProductionLine } = await import('@/api/production')
    await addProductionLine(1, { M_Product_ID: 5, MovementQty: 2 })
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/models/M_ProductionLine', expect.objectContaining({
      M_Production_ID: 1,
      M_Product_ID: 5,
    }))
  })

  it('getProductionLines fetches with filter', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { records: [{ id: 10 }] } })
    const { getProductionLines } = await import('@/api/production')
    const lines = await getProductionLines(1)
    expect(lines).toHaveLength(1)
  })
})
