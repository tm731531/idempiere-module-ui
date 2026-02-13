import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiClient } from '@/api/client'

vi.mock('@/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    defaults: { headers: { common: {} } },
  },
}))

describe('request API', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('listRequests fetches with expand', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { records: [{ id: 1, Summary: 'Test' }] } })
    const { listRequests } = await import('@/api/request')
    const results = await listRequests()
    expect(results).toHaveLength(1)
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/models/R_Request', expect.objectContaining({
      params: expect.objectContaining({ '$expand': 'R_Status_ID,C_BPartner_ID' }),
    }))
  })

  it('createRequest posts to R_Request', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { id: 1 } })
    const { createRequest } = await import('@/api/request')
    const result = await createRequest({ R_RequestType_ID: 1, Summary: 'Test', AD_Org_ID: 11 })
    expect(result.id).toBe(1)
  })

  it('updateRequestStatus uses PUT', async () => {
    vi.mocked(apiClient.put).mockResolvedValue({ data: { id: 1 } })
    const { updateRequestStatus } = await import('@/api/request')
    await updateRequestStatus(1, 100)
    expect(apiClient.put).toHaveBeenCalledWith('/api/v1/models/R_Request/1', { R_Status_ID: 100 })
  })

  it('listRequestTypes fetches active types', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { records: [{ id: 1, Name: 'Consultation' }] } })
    const { listRequestTypes } = await import('@/api/request')
    const types = await listRequestTypes()
    expect(types).toHaveLength(1)
  })
})
