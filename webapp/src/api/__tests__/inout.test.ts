import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiClient } from '@/api/client'

vi.mock('@/api/client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), delete: vi.fn(), defaults: { headers: { common: {} } } },
}))
vi.mock('@/api/lookup', () => ({
  lookupDocTypeId: vi.fn().mockResolvedValue(300),
  lookupBPartnerLocationId: vi.fn().mockResolvedValue(301),
}))

describe('inout API', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('listInOuts fetches with expand', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { records: [{ id: 1 }] } })
    const { listInOuts } = await import('@/api/inout')
    const results = await listInOuts()
    expect(results).toHaveLength(1)
  })

  it('createInOut for shipment uses MMS DocType', async () => {
    const lookup = await import('@/api/lookup')
    vi.mocked(lookup.lookupDocTypeId).mockResolvedValue(300)
    vi.mocked(apiClient.post).mockResolvedValue({ data: { id: 1 } })
    const { createInOut } = await import('@/api/inout')
    await createInOut({ C_BPartner_ID: 50, M_Warehouse_ID: 10, AD_Org_ID: 11, IsSOTrx: true })
    expect(lookup.lookupDocTypeId).toHaveBeenCalledWith('MMS')
  })

  it('createInOut throws when warehouseId is 0', async () => {
    const { createInOut } = await import('@/api/inout')
    await expect(createInOut({ C_BPartner_ID: 50, M_Warehouse_ID: 0, AD_Org_ID: 11, IsSOTrx: true })).rejects.toThrow('M_Warehouse_ID')
  })

  it('addInOutLine posts with locator', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { id: 10 } })
    const { addInOutLine } = await import('@/api/inout')
    await addInOutLine(1, { M_Product_ID: 5, MovementQty: 3, M_Locator_ID: 20 })
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/models/M_InOutLine', expect.objectContaining({
      M_InOut_ID: 1,
      M_Locator_ID: 20,
    }))
  })
})
