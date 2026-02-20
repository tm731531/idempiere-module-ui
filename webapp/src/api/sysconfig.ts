import { apiClient } from './client'

export interface SystemConfig {
  Name: string
  Value: string
  Description?: string
}

/**
 * 讀取 SysConfig 設定
 * @param name SysConfig 的 Name (例如 "MobileSettingConfig")
 */
export async function getSysConfig(name: string): Promise<string | null> {
  try {
    const resp = await apiClient.get('/api/v1/models/AD_SysConfig', {
      params: {
        '$filter': `Name eq '${name}'`,
        '$select': 'Name,Value',
      },
    })
    const records = resp.data.records || []
    if (records.length > 0) {
      return records[0].Value
    }
    return null
  } catch (e) {
    console.error('❌ Failed to load SysConfig:', name, e)
    return null
  }
}

/**
 * 更新 SysConfig 設定
 */
export async function updateSysConfig(name: string, value: string): Promise<boolean> {
  try {
    // First try to find existing record
    const resp = await apiClient.get('/api/v1/models/AD_SysConfig', {
      params: {
        '$filter': `Name eq '${name}'`,
        '$select': 'AD_SysConfig_ID,Name,Value',
      },
    })
    const records = resp.data.records || []

    if (records.length > 0) {
      // Update existing
      const configId = records[0].AD_SysConfig_ID
      await apiClient.put(`/api/v1/models/AD_SysConfig/${configId}`, { Value: value })
      console.log('✅ Updated SysConfig:', name)
      return true
    } else {
      // Create new - requires AD_Org_ID, AD_Client_ID, Name, Value
      try {
        await apiClient.post('/api/v1/models/AD_SysConfig', {
          AD_Org_ID: 0,
          AD_Client_ID: 0,
          Name: name,
          Value: value,
          Description: 'Mobile consultation request statuses',
        })
        console.log('✅ Created SysConfig:', name)
        return true
      } catch (createError: any) {
        if (createError.response?.status === 403) {
          console.error('❌ Permission denied creating SysConfig. Please ask administrator to create:', name)
        }
        throw createError
      }
    }
  } catch (e) {
    console.error('❌ Failed to update SysConfig:', name, e)
    return false
  }
}
