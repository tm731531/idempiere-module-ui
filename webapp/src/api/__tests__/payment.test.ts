import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiClient } from '@/api/client'

vi.mock('@/api/client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), defaults: { headers: { common: {} } } },
}))
vi.mock('@/api/lookup', () => ({
  lookupDocTypeId: vi.fn().mockResolvedValue(200),
  lookupDefaultPaymentTermId: vi.fn().mockResolvedValue(201),
}))

describe('payment API', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('listPayments fetches with expand', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { records: [{ id: 1 }] } })
    const { listPayments } = await import('@/api/payment')
    const results = await listPayments()
    expect(results).toHaveLength(1)
  })

  it('createPayment looks up DocType and posts', async () => {
    const lookup = await import('@/api/lookup')
    vi.mocked(lookup.lookupDocTypeId).mockResolvedValue(200)
    vi.mocked(apiClient.post).mockResolvedValue({ data: { id: 1 } })
    const { createPayment } = await import('@/api/payment')
    await createPayment({ C_BPartner_ID: 50, PayAmt: 1000, TenderType: 'X', AD_Org_ID: 11 })
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/models/C_Payment', expect.objectContaining({
      C_DocType_ID: 200,
      IsReceipt: true,
      TenderType: 'X',
    }))
  })
})
