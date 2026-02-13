import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { apiClient } from '@/api/client'

vi.mock('@/api/client', () => ({
  apiClient: {
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
    defaults: { headers: { common: {} } },
  },
  clearSessionExpired: vi.fn(),
}))

vi.mock('@/api/lookup', () => ({
  clearLookupCache: vi.fn(),
}))

describe('auth store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('should start at credentials step', () => {
    const auth = useAuthStore()
    expect(auth.loginStep).toBe('credentials')
    expect(auth.isAuthenticated).toBe(false)
  })

  it('should authenticate and move to client step', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      data: { token: 'test-token', clients: [{ id: 1, name: 'A' }, { id: 2, name: 'B' }] },
    })
    const auth = useAuthStore()
    const result = await auth.authenticate('admin', 'pass')
    expect(result).toBe(true)
    expect(auth.loginStep).toBe('client')
    expect(auth.availableClients).toHaveLength(2)
  })

  it('should auto-skip single client', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      data: { token: 'test-token', clients: [{ id: 1, name: 'Only' }] },
    })
    vi.mocked(apiClient.get).mockResolvedValue({
      data: { roles: [{ id: 10, name: 'Admin' }, { id: 20, name: 'User' }] },
    })
    const auth = useAuthStore()
    await auth.authenticate('admin', 'pass')
    expect(auth.loginStep).toBe('role')
  })

  it('should logout and clear state', () => {
    const auth = useAuthStore()
    auth.logout()
    expect(auth.token).toBeNull()
    expect(auth.isAuthenticated).toBe(false)
    expect(auth.loginStep).toBe('credentials')
  })
})
