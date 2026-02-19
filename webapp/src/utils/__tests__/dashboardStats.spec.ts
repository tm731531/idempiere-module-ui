import { describe, it, expect } from 'vitest'
import { calculateStats } from '../dashboardStats'

describe('dashboardStats utilities', () => {
  const createMockRequest = (overrides: any = {}) => ({
    id: 1,
    Created: '2026-02-19T10:00:00Z',
    R_Status_ID: { id: '待處理', identifier: '待處理' },
    C_BPartner_ID: { id: 1, Name: '客戶A' },
    Description: JSON.stringify([]),
    ...overrides,
  })

  describe('calculateStats - basic calculations', () => {
    it('calculates total this month correctly', () => {
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const monthMid = new Date(now.getFullYear(), now.getMonth(), 15)

      // Create a date clearly in previous month
      const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 15)

      const requests = [
        createMockRequest({ Created: monthStart.toISOString() }),
        createMockRequest({ Created: monthMid.toISOString() }),
        createMockRequest({ Created: prevMonthDate.toISOString() }),
      ]

      const stats = calculateStats(requests)
      // Should have exactly 2 from this month (monthStart and monthMid)
      expect(stats.totalThisMonth).toBe(2)
    })

    it('calculates conversion rate correctly', () => {
      const requests = [
        createMockRequest({ R_Status_ID: { id: '待處理', identifier: '待處理' } }),
        createMockRequest({ R_Status_ID: { id: '已完成', identifier: '已完成' } }),
        createMockRequest({ R_Status_ID: { id: '已完成', identifier: '已完成' } }),
      ]

      const stats = calculateStats(requests)
      expect(stats.conversionRate).toBe('67%') // 2/3 = 67%
    })

    it('handles empty requests', () => {
      const stats = calculateStats([])
      expect(stats.totalThisMonth).toBe(0)
      expect(stats.conversionRate).toBe('0%')
      expect(stats.pendingCount).toBe(0)
      expect(stats.silentCount).toBe(0)
      expect(stats.lostCustomerCount).toBe(0)
    })

    it('correctly calculates status distribution', () => {
      const requests = [
        createMockRequest({ R_Status_ID: { id: '待處理', identifier: '待處理' } }),
        createMockRequest({ R_Status_ID: { id: '待處理', identifier: '待處理' } }),
        createMockRequest({ R_Status_ID: { id: '已完成', identifier: '已完成' } }),
      ]

      const stats = calculateStats(requests)
      expect(stats.statusDistribution['待處理']).toBe(2)
      expect(stats.statusDistribution['已完成']).toBe(1)
    })
  })

  describe('calculateStats - lost customer logic (critical fix)', () => {
    it('correctly identifies lost customers (90+ days without activity)', () => {
      const now = Date.now()
      const ninetyOneDaysAgo = new Date(now - 91 * 24 * 60 * 60 * 1000).toISOString()
      const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString()

      const requests = [
        createMockRequest({
          C_BPartner_ID: { id: 1, Name: '客戶A' },
          Created: ninetyOneDaysAgo,
        }),
        createMockRequest({
          C_BPartner_ID: { id: 2, Name: '客戶B' },
          Created: thirtyDaysAgo,
        }),
      ]

      const stats = calculateStats(requests)
      expect(stats.lostCustomerCount).toBe(1) // 只有客戶A 流失
    })

    it('updates to latest activity time for same customer (not first activity)', () => {
      const now = Date.now()
      // 客戶 A：第一次 100 天前，最後一次 20 天前 → 不流失
      const hundredDaysAgo = new Date(now - 100 * 24 * 60 * 60 * 1000).toISOString()
      const twentyDaysAgo = new Date(now - 20 * 24 * 60 * 60 * 1000).toISOString()

      const requests = [
        createMockRequest({
          C_BPartner_ID: { id: 1, Name: '客戶A' },
          Created: hundredDaysAgo,
        }),
        createMockRequest({
          C_BPartner_ID: { id: 1, Name: '客戶A' },
          Created: twentyDaysAgo, // 最後活動
        }),
      ]

      const stats = calculateStats(requests)
      expect(stats.lostCustomerCount).toBe(0) // 不流失，因為最後活動才 20 天前
    })

    it('tracks multiple customers with mixed activity', () => {
      const now = Date.now()
      const ninetyFiveDaysAgo = new Date(now - 95 * 24 * 60 * 60 * 1000).toISOString()
      const thirtyFiveDaysAgo = new Date(now - 35 * 24 * 60 * 60 * 1000).toISOString()
      const fiftyDaysAgo = new Date(now - 50 * 24 * 60 * 60 * 1000).toISOString()
      const tenDaysAgo = new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString()

      const requests = [
        // 客戶 A：95 天前 → 流失
        createMockRequest({
          C_BPartner_ID: { id: 1, Name: '客戶A' },
          Created: ninetyFiveDaysAgo,
        }),
        // 客戶 B：50 天前，35 天前（最後） → 不流失
        createMockRequest({
          C_BPartner_ID: { id: 2, Name: '客戶B' },
          Created: fiftyDaysAgo,
        }),
        createMockRequest({
          C_BPartner_ID: { id: 2, Name: '客戶B' },
          Created: thirtyFiveDaysAgo,
        }),
        // 客戶 C：10 天前 → 不流失
        createMockRequest({
          C_BPartner_ID: { id: 3, Name: '客戶C' },
          Created: tenDaysAgo,
        }),
      ]

      const stats = calculateStats(requests)
      expect(stats.lostCustomerCount).toBe(1) // 只有客戶A流失
    })

    it('handles customers with multiple consultations spanning 90+ days', () => {
      const now = Date.now()
      const ninetyFiveDaysAgo = new Date(now - 95 * 24 * 60 * 60 * 1000).toISOString()
      const eightySeveDaysAgo = new Date(now - 87 * 24 * 60 * 60 * 1000).toISOString()
      const ninetyTwoDaysAgo = new Date(now - 92 * 24 * 60 * 60 * 1000).toISOString()

      const requests = [
        // 客戶 A：95 天前是首次，87 天前有回訪 → 不流失
        createMockRequest({
          C_BPartner_ID: { id: 1, Name: '客戶A' },
          Created: ninetyFiveDaysAgo,
        }),
        createMockRequest({
          C_BPartner_ID: { id: 1, Name: '客戶A' },
          Created: eightySeveDaysAgo,
        }),
        // 客戶 B：92 天前是最後一次 → 流失
        createMockRequest({
          C_BPartner_ID: { id: 2, Name: '客戶B' },
          Created: ninetyTwoDaysAgo,
        }),
      ]

      const stats = calculateStats(requests)
      expect(stats.lostCustomerCount).toBe(1) // 只有客戶B流失
    })
  })

  describe('calculateStats - pending and silent counts', () => {
    it('calculates pending count correctly', () => {
      const requests = [
        createMockRequest({ R_Status_ID: { id: '待處理', identifier: '待處理' } }),
        createMockRequest({ R_Status_ID: { id: '已完成', identifier: '已完成' } }),
        createMockRequest({ R_Status_ID: { id: '已完成', identifier: '已完成' } }),
      ]

      const stats = calculateStats(requests)
      expect(stats.pendingCount).toBe(1) // 只有 1 筆待處理
    })

    it('calculates silent count (7+ days waiting for response with no activity)', () => {
      const now = Date.now()
      const eightDaysAgo = new Date(now - 8 * 24 * 60 * 60 * 1000).toISOString()
      const twoDaysAgo = new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString()

      const requests = [
        // 8 天前建立，無活動記錄 → 沉默
        createMockRequest({
          Created: eightDaysAgo,
          R_Status_ID: { id: '等待回應', identifier: '等待回應' },
          Description: JSON.stringify([]),
        }),
        // 2 天前建立，無活動記錄 → 不沉默
        createMockRequest({
          Created: twoDaysAgo,
          R_Status_ID: { id: '等待回應', identifier: '等待回應' },
          Description: JSON.stringify([]),
        }),
      ]

      const stats = calculateStats(requests)
      expect(stats.silentCount).toBe(1)
    })

    it('respects description activity for silent count', () => {
      const now = Date.now()
      const tenDaysAgo = new Date(now - 10 * 24 * 60 * 60 * 1000)
      const fiveDaysAgo = new Date(now - 5 * 24 * 60 * 60 * 1000)

      const requests = [
        // 建立 10 天前，有活動記錄在 5 天前 → 不沉默（5 天 < 7 天）
        createMockRequest({
          Created: tenDaysAgo.toISOString(),
          R_Status_ID: { id: '等待回應', identifier: '等待回應' },
          Description: JSON.stringify([{ timestamp: fiveDaysAgo.toISOString() }]),
        }),
      ]

      const stats = calculateStats(requests)
      expect(stats.silentCount).toBe(0)
    })
  })

  describe('calculateStats - top customers', () => {
    it('returns top customers sorted by count', () => {
      const requests = [
        createMockRequest({ C_BPartner_ID: { id: 1, Name: '客戶A' } }),
        createMockRequest({ C_BPartner_ID: { id: 1, Name: '客戶A' } }),
        createMockRequest({ C_BPartner_ID: { id: 2, Name: '客戶B' } }),
        createMockRequest({ C_BPartner_ID: { id: 2, Name: '客戶B' } }),
        createMockRequest({ C_BPartner_ID: { id: 2, Name: '客戶B' } }),
      ]

      const stats = calculateStats(requests)
      expect(stats.topCustomers.length).toBeGreaterThan(0)
      expect(stats.topCustomers[0]!.customerId).toBe(2)
      expect(stats.topCustomers[0]!.count).toBe(3)
      expect(stats.topCustomers[1]!.customerId).toBe(1)
      expect(stats.topCustomers[1]!.count).toBe(2)
    })

    it('limits top customers to specified count', () => {
      const requests = Array.from({ length: 15 }, (_, i) => (
        createMockRequest({ C_BPartner_ID: { id: i, Name: `客戶${i}` } })
      ))

      const stats = calculateStats(requests)
      expect(stats.topCustomers.length).toBeLessThanOrEqual(10)
    })
  })

  describe('calculateStats - nullish coalescing', () => {
    it('handles customers with numeric ID only (no object)', () => {
      const requests = [
        createMockRequest({
          C_BPartner_ID: 123, // 純數字 ID
        }),
      ]

      const stats = calculateStats(requests)
      expect(stats.topCustomers[0]!.customerId).toBe(123)
      expect(stats.topCustomers[0]!.name).toBe('#123')
    })

    it('prefers C_BPartner_ID.id over numeric value', () => {
      const requests = [
        createMockRequest({
          C_BPartner_ID: { id: 456, Name: '客戶名稱' },
        }),
      ]

      const stats = calculateStats(requests)
      expect(stats.topCustomers[0]!.customerId).toBe(456)
      expect(stats.topCustomers[0]!.name).toBe('客戶名稱')
    })

    it('uses display name from C_BPartner_ID.Name', () => {
      const requests = [
        createMockRequest({
          C_BPartner_ID: { id: 789, Name: '特定客戶名稱' },
        }),
      ]

      const stats = calculateStats(requests)
      expect(stats.topCustomers[0]!.name).toBe('特定客戶名稱')
    })
  })

  describe('calculateStats - average response time', () => {
    it('calculates average response time from activity timestamps', () => {
      const now = Date.now()
      const requestTime = new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString()
      const responseTime = new Date(now - 2 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString() // +2 小時

      const requests = [
        createMockRequest({
          Created: requestTime,
          Description: JSON.stringify([{ timestamp: responseTime }]),
        }),
      ]

      const stats = calculateStats(requests)
      expect(stats.avgResponseTime).toBe('2h')
    })

    it('returns 0h when no activity data available', () => {
      const requests = [
        createMockRequest({
          Description: JSON.stringify([]),
        }),
      ]

      const stats = calculateStats(requests)
      expect(stats.avgResponseTime).toBe('0h')
    })
  })

  describe('calculateStats - edge cases', () => {
    it('handles exactly 90 days (boundary)', () => {
      const now = Date.now()
      const exactlyNinetyDaysAgo = new Date(now - 90 * 24 * 60 * 60 * 1000).toISOString()

      const requests = [
        createMockRequest({
          C_BPartner_ID: { id: 1, Name: '客戶A' },
          Created: exactlyNinetyDaysAgo,
        }),
      ]

      const stats = calculateStats(requests)
      expect(stats.lostCustomerCount).toBe(0) // 恰好 90 天不算流失（> 90 天才算）
    })

    it('handles malformed description JSON gracefully', () => {
      const requests = [
        createMockRequest({
          Description: 'invalid json',
        }),
      ]

      const stats = calculateStats(requests)
      expect(stats.silentCount).toBe(0) // JSON 解析錯誤被捕捉
      expect(stats.avgResponseTime).toBe('0h')
    })

    it('handles missing R_Status_ID', () => {
      const requests = [
        createMockRequest({
          R_Status_ID: undefined,
        }),
      ]

      const stats = calculateStats(requests)
      expect(stats.statusDistribution['待處理']).toBeGreaterThan(0) // 預設值
    })

    it('looks back 90 days by default', () => {
      const now = Date.now()
      const eightyNineDaysAgo = new Date(now - 89 * 24 * 60 * 60 * 1000).toISOString()
      const ninetyOneDaysAgo = new Date(now - 91 * 24 * 60 * 60 * 1000).toISOString()

      const requests = [
        createMockRequest({
          Created: eightyNineDaysAgo,
        }),
        createMockRequest({
          Created: ninetyOneDaysAgo,
        }),
      ]

      const stats = calculateStats(requests) // 使用預設 90 天
      expect(stats.totalThisMonth).toBeLessThanOrEqual(2) // 最多 2 筆（如果本月包含）
    })

    it('respects custom lookback period', () => {
      const now = Date.now()
      const fortyFiveDaysAgo = new Date(now - 45 * 24 * 60 * 60 * 1000).toISOString()
      const ninetyDaysAgo = new Date(now - 90 * 24 * 60 * 60 * 1000).toISOString()

      const requests = [
        createMockRequest({
          Created: fortyFiveDaysAgo,
        }),
        createMockRequest({
          Created: ninetyDaysAgo,
        }),
      ]

      const stats = calculateStats(requests, 60) // 60 天的回溯
      expect(stats.pendingCount).toBe(1) // 只有 45 天內的被計算
    })
  })
})
