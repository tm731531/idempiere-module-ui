import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiClient } from '@/api/client'

vi.mock('@/api/client', () => ({
  apiClient: { get: vi.fn(), defaults: { headers: { common: {} } } },
}))

describe('usePermission', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('allows all pages when no SysConfig found (blocklist model)', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { records: [] } })

    const mod = await import('@/composables/usePermission')
    mod.clearPermissionCache()
    const { loadPermissions, canAccess } = mod.usePermission()
    await loadPermissions(100)
    expect(canAccess('customer')).toBe(true)
    expect(canAccess('consultation')).toBe(true)
    expect(canAccess('calendar')).toBe(true)
  })

  it('restricts pages based on SysConfig value', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: { records: [{ Value: 'appointment,consultation' }] },
    })

    const mod = await import('@/composables/usePermission')
    mod.clearPermissionCache()
    const { loadPermissions, canAccess } = mod.usePermission()
    await loadPermissions(100)
    expect(canAccess('appointment')).toBe(true)
    expect(canAccess('consultation')).toBe(true)
    expect(canAccess('customer')).toBe(false)
  })

  it('canAccessFieldConfig checks userLevel for S', async () => {
    const mod = await import('@/composables/usePermission')
    const { canAccessFieldConfig } = mod.usePermission()
    expect(canAccessFieldConfig('SCO')).toBe(true)
    expect(canAccessFieldConfig('CO')).toBe(false)
  })
})
