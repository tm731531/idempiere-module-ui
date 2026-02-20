import { apiClient } from './client'
import { useAuthStore } from '@/stores/auth'

export interface SystemConfig {
  Name: string
  Value: string
  Description?: string
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
        console.log(`✅ Found SysConfig '${name}' at client=${records[0].AD_Client_ID}, org=${records[0].AD_Org_ID}`)
        return records[0].Value
      }
    }

    console.log(`⚠️ SysConfig '${name}' not found for any tenant level`)
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
    console.log(`📡 getSysConfig response for org-level: ${records.length} records`)

    if (records.length > 0) {
      // Update existing
      console.log('📋 Full record:', JSON.stringify(records[0], null, 2))
      console.log('📋 All keys:', Object.keys(records[0]))
      const configId = records[0].AD_SysConfig_ID || records[0].id || records[0].adSysconfigId
      console.log(`🔍 Found configId=${configId} (type: ${typeof configId})`)
      if (!configId) {
        console.error('❌ No ID field found. Available keys:', Object.keys(records[0]))
        return false
      }
      await apiClient.put(`/api/v1/models/AD_SysConfig/${configId}`, { Value: value })
      console.log('✅ Updated SysConfig at organization level:', name)
      return true
    } else {
      // Create new org-specific record
      console.log(`📝 Creating new SysConfig for org ${authStore.context.organizationId}`)
      try {
        await apiClient.post('/api/v1/models/AD_SysConfig', {
          AD_Client_ID: authStore.context.clientId,
          AD_Org_ID: authStore.context.organizationId,
          Name: name,
          Value: value,
          Description: 'Mobile consultation request statuses',
        })
        console.log('✅ Created SysConfig at organization level:', name)
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
