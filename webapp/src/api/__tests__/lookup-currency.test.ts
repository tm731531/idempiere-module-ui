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

describe('lookupDefaultCurrencyId', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it('returns currency from SO price list when available', async () => {
    // First call: lookupSOCurrencyId -> lookupSalesPriceListId
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: {
        records: [{
          id: 100, Name: 'Standard', IsDefault: true,
          C_Currency_ID: { id: 121, identifier: 'TWD' },
        }],
      },
    })

    const { lookupDefaultCurrencyId } = await import('@/api/lookup')
    const result = await lookupDefaultCurrencyId()
    expect(result).toBe(121)
  })

  it('falls back to C_Currency query when no SO price list', async () => {
    // lookupSalesPriceListId returns empty
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { records: [] },
    })
    // Fallback C_Currency query
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { records: [{ id: 205, ISO_Code: 'TWD' }] },
    })

    const { lookupDefaultCurrencyId } = await import('@/api/lookup')
    const result = await lookupDefaultCurrencyId()
    expect(result).toBe(205)
    // Second call should be to C_Currency
    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/v1/models/C_Currency',
      expect.objectContaining({
        params: expect.objectContaining({
          '$filter': 'IsActive eq true',
        }),
      }),
    )
  })

  it('returns 0 when no currency found at all', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { records: [] } })
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { records: [] } })

    const { lookupDefaultCurrencyId } = await import('@/api/lookup')
    const result = await lookupDefaultCurrencyId()
    expect(result).toBe(0)
  })
})
