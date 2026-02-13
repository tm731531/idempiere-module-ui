import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('API client', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('should export apiClient and sessionState', async () => {
    const { apiClient, sessionState } = await import('@/api/client')
    expect(apiClient).toBeDefined()
    expect(sessionState.expired).toBe(false)
  })

  it('should export generic CRUD api object', async () => {
    const { api } = await import('@/api/client')
    expect(api.getRecords).toBeTypeOf('function')
    expect(api.getRecord).toBeTypeOf('function')
    expect(api.createRecord).toBeTypeOf('function')
    expect(api.updateRecord).toBeTypeOf('function')
    expect(api.deleteRecord).toBeTypeOf('function')
  })
})
