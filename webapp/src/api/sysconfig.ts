import { apiClient } from './client'
import { useAuthStore } from '@/stores/auth'

export interface SystemConfig {
  Name: string
  Value: string
  Description?: string
}

// ========== Color System Keys ==========
const RESOURCE_COLORS_KEY = 'RESOURCE_COLORS'
const ASSIGNMENT_COLORS_KEY = 'ASSIGNMENT_COLORS'

/**
 * Get per-resource colors from SysConfig.
 * Returns a map of resourceId → hex color string.
 */
export async function getResourceColors(): Promise<Record<number, string>> {
  const raw = await getSysConfig(RESOURCE_COLORS_KEY)
  if (!raw) return {}
  try {
    return JSON.parse(raw) as Record<number, string>
  } catch {
    return {}
  }
}

/**
 * Persist per-resource color map to SysConfig.
 */
export async function setResourceColors(colors: Record<number, string>): Promise<void> {
  await updateSysConfig(RESOURCE_COLORS_KEY, JSON.stringify(colors))
}

/**
 * Get per-assignment color overrides from SysConfig.
 * Returns a map of assignmentId → hex color string.
 */
export async function getAssignmentColors(): Promise<Record<number, string>> {
  const raw = await getSysConfig(ASSIGNMENT_COLORS_KEY)
  if (!raw) return {}
  try {
    return JSON.parse(raw) as Record<number, string>
  } catch {
    return {}
  }
}

/**
 * Set or clear a color override for a single assignment.
 * Merges into the existing map. Pass null to remove the override.
 */
export async function setAssignmentColor(assignmentId: number, color: string | null): Promise<void> {
  const existing = await getAssignmentColors()
  if (color === null) {
    delete existing[assignmentId]
  } else {
    existing[assignmentId] = color
  }
  await updateSysConfig(ASSIGNMENT_COLORS_KEY, JSON.stringify(existing))
}

/**
 * 讀取 SysConfig 設定 - 根據當前 tenant 取用
 * @param name SysConfig 的 Name (例如 "MobileSettingConfig")
 */
export async function getSysConfig(name: string): Promise<string | null> {
  try {
    const authStore = useAuthStore()
    if (!authStore.context) {
      console.error('❌ No auth context available')
      return null
    }

    // 按 tenant 過濾：先查詢 org-specific，再查詢 client-wide，最後查詢 system-wide
    const filters = [
      // 1. Organization-specific
      `Name eq '${name}' and AD_Client_ID eq ${authStore.context.clientId} and AD_Org_ID eq ${authStore.context.organizationId}`,
      // 2. Client-wide (AD_Org_ID = 0)
      `Name eq '${name}' and AD_Client_ID eq ${authStore.context.clientId} and AD_Org_ID eq 0`,
      // 3. System-wide (both 0)
      `Name eq '${name}' and AD_Client_ID eq 0 and AD_Org_ID eq 0`,
    ]

    for (const filter of filters) {
      const resp = await apiClient.get('/api/v1/models/AD_SysConfig', {
        params: {
          '$filter': filter,
          '$select': 'AD_SysConfig_ID,Name,Value,AD_Client_ID,AD_Org_ID',
        },
      })
      const records = resp.data.records || []
      if (records.length > 0) {
        return records[0].Value
      }
    }

    return null
  } catch (e) {
    console.error('❌ Failed to load SysConfig:', name, e)
    return null
  }
}

/**
 * 更新 SysConfig 設定 - 在當前 tenant 層級更新
 */
export async function updateSysConfig(name: string, value: string): Promise<boolean> {
  try {
    const authStore = useAuthStore()
    if (!authStore.context) {
      console.error('❌ No auth context available')
      return false
    }

    // 查詢當前 tenant 的記錄（org-specific）
    const filter = `Name eq '${name}' and AD_Client_ID eq ${authStore.context.clientId} and AD_Org_ID eq ${authStore.context.organizationId}`
    const resp = await apiClient.get('/api/v1/models/AD_SysConfig', {
      params: {
        '$filter': filter,
        '$select': 'AD_SysConfig_ID,Name,Value',
      },
    })
    const records = resp.data.records || []

    if (records.length > 0) {
      // Update existing
      const configId = records[0].AD_SysConfig_ID || records[0].id || records[0].adSysconfigId
      if (!configId) {
        console.error('❌ No ID field found. Available keys:', Object.keys(records[0]))
        return false
      }
      await apiClient.put(`/api/v1/models/AD_SysConfig/${configId}`, { Value: value })
      return true
    } else {
      // Create new org-specific record
      try {
        await apiClient.post('/api/v1/models/AD_SysConfig', {
          AD_Client_ID: authStore.context.clientId,
          AD_Org_ID: authStore.context.organizationId,
          Name: name,
          Value: value,
          Description: 'Mobile consultation request statuses',
        })
        return true
      } catch (createError: any) {
        if (createError.response?.status === 403) {
          console.error('❌ Permission denied creating SysConfig. Admin needs to create initial record.')
        }
        throw createError
      }
    }
  } catch (e) {
    console.error('❌ Failed to update SysConfig:', name, e)
    return false
  }
}
