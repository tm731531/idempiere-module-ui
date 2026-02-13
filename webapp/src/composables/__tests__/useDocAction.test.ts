import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiClient } from '@/api/client'

vi.mock('@/api/client', () => ({
  apiClient: { post: vi.fn(), get: vi.fn(), defaults: { headers: { common: {} } } },
}))

describe('useDocAction', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('canComplete returns true for DR, IP, WP', async () => {
    const { canComplete } = await import('@/composables/useDocAction')
    expect(canComplete('DR')).toBe(true)
    expect(canComplete('IP')).toBe(true)
    expect(canComplete('WP')).toBe(true)
    expect(canComplete('CO')).toBe(false)
    expect(canComplete('VO')).toBe(false)
  })

  it('isLocked returns true for non-DR status', async () => {
    const { isLocked } = await import('@/composables/useDocAction')
    expect(isLocked('DR')).toBe(false)
    expect(isLocked('CO')).toBe(true)
    expect(isLocked('IP')).toBe(true)
  })

  it('completeDocument POSTs to process endpoint', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { isError: false, summary: 'OK' } })

    const { completeDocument } = await import('@/composables/useDocAction')
    const result = await completeDocument('C_Order', 123)
    expect(result.success).toBe(true)
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/processes/c_order-process', {
      'record-id': 123,
      'table-id': 259,
    })
  })

  it('completeDocument returns error on isError response', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { isError: true, summary: '庫存不足' } })

    const { completeDocument } = await import('@/composables/useDocAction')
    const result = await completeDocument('C_Order', 123)
    expect(result.success).toBe(false)
    expect(result.error).toBe('庫存不足')
  })

  it('returns error for unknown table', async () => {
    const { completeDocument } = await import('@/composables/useDocAction')
    const result = await completeDocument('Unknown_Table', 1)
    expect(result.success).toBe(false)
    expect(result.error).toContain('No process mapping')
  })
})
