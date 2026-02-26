/**
 * Request Conversion API Module
 *
 * 處理諮詢轉訂單的相關 API 操作
 * - 查詢已轉化的諮詢
 * - 在諮詢活動時間軸中添加轉化記錄
 * - 計算轉化統計
 */

import { apiClient } from './client'

export interface RequestActivity {
  timestamp: string
  type: 'Activity' | 'StatusChange' | 'Created'
  actionType: string
  content: string
  createdBy: number
  id?: string
  linkedOrderId?: number
  linkedOrderNo?: string
}

/**
 * 查詢已轉化為訂單的諮詢（指定日期範圍）
 * @param dateFrom ISO datetime string, e.g., "2026-02-01T00:00:00Z"
 * @param dateTo ISO datetime string
 * @returns 所有有"轉化訂單"活動的諮詢
 */
export async function listConvertedRequests(dateFrom?: string, dateTo?: string): Promise<any[]> {
  let filter = 'Description ne null'
  if (dateFrom) {
    filter += ` and Created ge datetime'${dateFrom}'`
  }
  if (dateTo) {
    filter += ` and Created le datetime'${dateTo}'`
  }

  try {
    const params = {
      '$select': 'R_Request_ID,Summary,C_BPartner_ID,Created,Updated,Description,R_Status_ID',
      '$filter': filter,
      '$expand': 'C_BPartner_ID,R_Status_ID',
      '$orderby': 'Created desc',
      '$top': '500',
    }

    const resp = await apiClient.get('/api/v1/models/R_Request', { params })
    const records = resp.data.records || []

    // 前端篩選：只返回有"轉化訂單"活動的諮詢
    return records.filter((req: any) => {
      try {
        const activities = JSON.parse(req.Description || '[]')
        return Array.isArray(activities) && activities.some(a => a.actionType === 'ConversionOrder')
      } catch {
        return false
      }
    })
  } catch (error) {
    console.error('❌ listConvertedRequests error:', error)
    throw error
  }
}

/**
 * 在諮詢活動時間軸中添加新活動（如轉化訂單）
 * @param requestId R_Request_ID
 * @param activity 新活動物件
 */
export async function appendActivityToRequest(
  requestId: number,
  activity: RequestActivity
): Promise<any> {
  try {
    // 1. 先獲取當前諮詢
    const resp = await apiClient.get(`/api/v1/models/R_Request/${requestId}`)
    const request = resp.data

    // 2. 解析現有活動
    let activities: RequestActivity[] = []
    try {
      activities = JSON.parse(request.Description || '[]')
      if (!Array.isArray(activities)) activities = []
    } catch {
      activities = []
    }

    // 3. 添加新活動，自動生成 ID
    const newActivity = {
      ...activity,
      id: activity.id || `act-${Date.now()}`,
    }
    activities.push(newActivity)

    // 4. 更新諮詢
    const updatePayload = {
      Description: JSON.stringify(activities),
    }

    const updateResp = await apiClient.put(`/api/v1/models/R_Request/${requestId}`, updatePayload)

    console.log(`✅ appendActivityToRequest - 活動已添加到諮詢 #${requestId}`)
    return updateResp.data
  } catch (error) {
    console.error(`❌ appendActivityToRequest error:`, error)
    throw error
  }
}

/**
 * 創建轉化訂單活動記錄（當訂單建立成功時調用）
 * @param requestId R_Request_ID
 * @param orderId C_Order_ID
 * @param orderNo 訂單號
 * @param userId 建立訂單的用戶 ID
 * @param description 可選的活動描述
 */
export async function recordConversionOrder(
  requestId: number,
  orderId: number,
  orderNo: string,
  userId: number,
  description?: string
): Promise<any> {
  const activity: RequestActivity = {
    timestamp: new Date().toISOString(),
    type: 'StatusChange',
    actionType: 'ConversionOrder',
    content: description || `轉化為訂單 #${orderNo}，客戶已確認方案`,
    createdBy: userId,
    linkedOrderId: orderId,
    linkedOrderNo: orderNo,
  }

  return appendActivityToRequest(requestId, activity)
}

/**
 * 查詢諮詢的轉化狀態
 * @param requestId R_Request_ID
 * @returns 轉化狀態信息
 */
export async function getRequestConversionStatus(requestId: number): Promise<{
  isConverted: boolean
  orderId?: number
  orderNo?: string
  conversionTime?: string
  convertedBy?: number
}> {
  try {
    const resp = await apiClient.get(`/api/v1/models/R_Request/${requestId}`, {
      params: { '$select': 'R_Request_ID,Description,Created' },
    })

    const request = resp.data
    const status = {
      isConverted: false,
      orderId: undefined,
      orderNo: undefined,
      conversionTime: undefined,
      convertedBy: undefined,
    }

    try {
      const activities = JSON.parse(request.Description || '[]')
      const conversionActivity = activities.find((a: any) => a.actionType === 'ConversionOrder')

      if (conversionActivity) {
        status.isConverted = true
        status.orderId = conversionActivity.linkedOrderId
        status.orderNo = conversionActivity.linkedOrderNo
        status.conversionTime = conversionActivity.timestamp
        status.convertedBy = conversionActivity.createdBy
      }
    } catch {
      // JSON 解析失敗，保持預設狀態
    }

    return status
  } catch (error) {
    console.error(`❌ getRequestConversionStatus error:`, error)
    throw error
  }
}

/**
 * 批量查詢轉化統計（用於儀表板）
 * @param requests 諮詢列表
 * @returns 統計結果
 */
export function calculateConversionStats(requests: any[]): {
  totalCount: number
  convertedCount: number
  conversionRate: string
  avgConversionDays: string
  pendingCount: number
} {
  if (!requests || requests.length === 0) {
    return {
      totalCount: 0,
      convertedCount: 0,
      conversionRate: '0%',
      avgConversionDays: '-',
      pendingCount: 0,
    }
  }

  // 統計已轉化
  const converted = requests.filter(req => {
    try {
      const activities = JSON.parse(req.Description || '[]')
      return Array.isArray(activities) && activities.some(a => a.actionType === 'ConversionOrder')
    } catch {
      return false
    }
  })

  // 計算轉化時間
  const conversionTimes = converted
    .map(req => {
      try {
        const activities = JSON.parse(req.Description || '[]')
        const convActivity = activities.find((a: any) => a.actionType === 'ConversionOrder')
        if (!convActivity) return null

        const diff = new Date(convActivity.timestamp).getTime() - new Date(req.Created).getTime()
        return diff / (1000 * 60 * 60 * 24) // 天數
      } catch {
        return null
      }
    })
    .filter((t: any) => t !== null)

  // 統計待轉化（7天以上未轉化）
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  const pending = requests.filter(req => {
    const created = new Date(req.Created)
    if (created > sevenDaysAgo) return false

    try {
      const activities = JSON.parse(req.Description || '[]')
      return !activities.some((a: any) => a.actionType === 'ConversionOrder')
    } catch {
      return true
    }
  })

  // 組合結果
  const rate = (converted.length / requests.length) * 100
  const avgDays = conversionTimes.length > 0
    ? ((conversionTimes as number[]).reduce((a: number, b: number) => a + b, 0) / conversionTimes.length).toFixed(1)
    : '-'

  return {
    totalCount: requests.length,
    convertedCount: converted.length,
    conversionRate: `${rate.toFixed(1)}%`,
    avgConversionDays: avgDays === '-' ? '-' : `${avgDays} 天`,
    pendingCount: pending.length,
  }
}
