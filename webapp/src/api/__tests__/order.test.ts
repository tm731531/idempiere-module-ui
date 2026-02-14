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

vi.mock('@/api/lookup', () => ({
  lookupDocTypeId: vi.fn().mockResolvedValue(100),
  lookupSalesPriceListId: vi.fn().mockResolvedValue(101),
  lookupDefaultPaymentTermId: vi.fn().mockResolvedValue(102),
  lookupDefaultTaxId: vi.fn().mockResolvedValue(103),
  lookupCurrentUserId: vi.fn().mockResolvedValue(104),
  lookupBPartnerLocationId: vi.fn().mockResolvedValue(105),
  lookupSOCurrencyId: vi.fn().mockResolvedValue(106),
}))

describe('order API', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('listOrders fetches with expand', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { records: [{ id: 1, DocumentNo: 'SO-001' }] } })
    const { listOrders } = await import('@/api/order')
    const results = await listOrders()
    expect(results).toHaveLength(1)
  })

  it('createOrder does parallel lookups and posts', async () => {
    // Re-mock after restoreAllMocks
    const lookup = await import('@/api/lookup')
    vi.mocked(lookup.lookupDocTypeId).mockResolvedValue(100)
    vi.mocked(lookup.lookupSalesPriceListId).mockResolvedValue(101)
    vi.mocked(lookup.lookupDefaultPaymentTermId).mockResolvedValue(102)
    vi.mocked(lookup.lookupCurrentUserId).mockResolvedValue(104)

    vi.mocked(apiClient.post).mockResolvedValue({ data: { id: 1 } })
    const { createOrder } = await import('@/api/order')
    const result = await createOrder({ C_BPartner_ID: 50, AD_Org_ID: 11, M_Warehouse_ID: 10 })
    expect(result.id).toBe(1)
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/models/C_Order', expect.objectContaining({
      C_DocTypeTarget_ID: 100,
      M_PriceList_ID: 101,
      IsSOTrx: true,
    }))
  })

  it('createOrder throws when warehouseId is 0', async () => {
    const { createOrder } = await import('@/api/order')
    await expect(createOrder({ C_BPartner_ID: 50, AD_Org_ID: 11, M_Warehouse_ID: 0 })).rejects.toThrow('M_Warehouse_ID')
  })

  it('addOrderLine looks up tax and posts', async () => {
    const lookup = await import('@/api/lookup')
    vi.mocked(lookup.lookupDefaultTaxId).mockResolvedValue(103)
    vi.mocked(apiClient.post).mockResolvedValue({ data: { id: 10 } })
    const { addOrderLine } = await import('@/api/order')
    await addOrderLine(1, { M_Product_ID: 5, QtyOrdered: 2, PriceEntered: 100 })
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/models/C_OrderLine', expect.objectContaining({
      C_Order_ID: 1,
      C_Tax_ID: 103,
    }))
  })

  it('getOrderLines fetches with filter and expand', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { records: [{ id: 10 }] } })
    const { getOrderLines } = await import('@/api/order')
    const lines = await getOrderLines(1)
    expect(lines).toHaveLength(1)
  })
})
