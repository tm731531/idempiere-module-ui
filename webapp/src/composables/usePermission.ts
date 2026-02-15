import { ref } from 'vue'
import { apiClient } from '@/api/client'

const ALL_BUSINESS_PAGES = [
  'customer', 'appointment', 'consultation', 'order', 'treatment',
  'payment', 'shipment', 'product', 'calendar',
]

const allowedPages = ref<string[]>([...ALL_BUSINESS_PAGES])
let loaded = false

export function clearPermissionCache(): void {
  allowedPages.value = [...ALL_BUSINESS_PAGES]
  loaded = false
}

export function usePermission() {
  async function loadPermissions(roleId: number): Promise<void> {
    if (loaded) return
    try {
      const resp = await apiClient.get('/api/v1/models/AD_SysConfig', {
        params: {
          '$filter': `Name eq 'AESTHETICS_ROLE_${roleId}_PAGES' and IsActive eq true`,
          '$select': 'Value',
        },
      })
      const records = resp.data?.records || []
      if (records.length > 0 && records[0].Value) {
        allowedPages.value = records[0].Value.split(',').map((s: string) => s.trim())
      }
      // If no SysConfig found, keep all pages allowed (blocklist model)
    } catch {
      // On error, keep all pages allowed
    }
    loaded = true
  }

  function canAccess(pageKey: string): boolean {
    return allowedPages.value.includes(pageKey)
  }

  function canAccessFieldConfig(userLevel: string): boolean {
    return userLevel.includes('S')
  }

  return { loadPermissions, canAccess, canAccessFieldConfig, allowedPages }
}
