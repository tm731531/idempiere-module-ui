import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiClient } from '@/api/client'

vi.mock('@/api/client', () => ({
  apiClient: { get: vi.fn() },
}))

import {
  loadAppointmentServices,
  clearAppointmentServiceCache,
  getServiceDuration,
} from '@/composables/useAppointmentServices'

describe('useAppointmentServices', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearAppointmentServiceCache()
  })

  it('returns empty list when AD_Reference does not exist', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { records: [] } })
    const result = await loadAppointmentServices()
    expect(result).toEqual([])
  })

  it('loads services from AD_Ref_List when reference exists', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce({ data: { records: [{ id: 100, AD_Reference_ID: 100 }] } })
      .mockResolvedValueOnce({
        data: {
          records: [
            { Value: 'CONSULT', Name: '諮詢', Description: '30' },
            { Value: 'TREAT', Name: '療程', Description: '60' },
          ],
        },
      })
    const result = await loadAppointmentServices()
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ Value: 'CONSULT', Name: '諮詢', durationMinutes: 30 })
    expect(result[1]).toEqual({ Value: 'TREAT', Name: '療程', durationMinutes: 60 })
  })

  it('caches results on second call', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { records: [] } })
    await loadAppointmentServices()
    await loadAppointmentServices()
    expect(apiClient.get).toHaveBeenCalledTimes(1)
  })

  it('getServiceDuration returns 0 when service not found', () => {
    expect(getServiceDuration('UNKNOWN')).toBe(0)
  })

  it('getServiceDuration returns duration after load', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce({ data: { records: [{ id: 5, AD_Reference_ID: 5 }] } })
      .mockResolvedValueOnce({
        data: { records: [{ Value: 'FACIAL', Name: '臉部護理', Description: '45' }] },
      })
    await loadAppointmentServices()
    expect(getServiceDuration('FACIAL')).toBe(45)
  })

  it('handles non-numeric Description gracefully', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce({ data: { records: [{ id: 3 }] } })
      .mockResolvedValueOnce({
        data: { records: [{ Value: 'SVC', Name: '服務', Description: 'invalid' }] },
      })
    const result = await loadAppointmentServices()
    expect(result[0]!.durationMinutes).toBe(0)
  })

  it('falls back to empty list on network error', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('network'))
    const result = await loadAppointmentServices()
    expect(result).toEqual([])
  })
})
