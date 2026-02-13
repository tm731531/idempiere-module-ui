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

vi.mock('@/api/lookup', () => ({
  lookupCustomerGroupId: vi.fn().mockResolvedValue(100),
}))

describe('bpartner API', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('createCustomer calls 4 APIs in sequence', async () => {
    // Re-mock after restoreAllMocks
    const { lookupCustomerGroupId } = await import('@/api/lookup')
    vi.mocked(lookupCustomerGroupId).mockResolvedValue(100)

    vi.mocked(apiClient.post)
      .mockResolvedValueOnce({ data: { id: 1 } })   // C_Location
      .mockResolvedValueOnce({ data: { id: 2 } })   // C_BPartner
      .mockResolvedValueOnce({ data: { id: 3 } })   // C_BPartner_Location
      .mockResolvedValueOnce({ data: { id: 4 } })   // AD_User

    const { createCustomer } = await import('@/api/bpartner')
    const result = await createCustomer({ name: 'Test Customer' }, 11)

    expect(result).toEqual({ bpartnerId: 2, locationId: 1, bpLocationId: 3, userId: 4 })
    expect(apiClient.post).toHaveBeenCalledTimes(4)
  })

  it('createCustomer rolls back on failure', async () => {
    const { lookupCustomerGroupId } = await import('@/api/lookup')
    vi.mocked(lookupCustomerGroupId).mockResolvedValue(100)

    vi.mocked(apiClient.post)
      .mockResolvedValueOnce({ data: { id: 1 } })   // C_Location
      .mockResolvedValueOnce({ data: { id: 2 } })   // C_BPartner
      .mockResolvedValueOnce({ data: { id: 3 } })   // C_BPartner_Location
      .mockRejectedValueOnce(new Error('AD_User failed')) // AD_User fails

    vi.mocked(apiClient.delete).mockResolvedValue({ data: {} })

    const { createCustomer } = await import('@/api/bpartner')
    await expect(createCustomer({ name: 'Test' }, 11)).rejects.toThrow('AD_User failed')

    // Should have attempted rollback deletes
    expect(apiClient.delete).toHaveBeenCalled()
  })

  it('searchCustomers queries with contains filter', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: { records: [{ id: 1, Name: 'Test', TaxID: 'A123' }] },
    })

    const { searchCustomers } = await import('@/api/bpartner')
    const results = await searchCustomers('Test')
    expect(results).toHaveLength(1)
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/models/C_BPartner', expect.objectContaining({
      params: expect.objectContaining({ '$top': 50 }),
    }))
  })
})
