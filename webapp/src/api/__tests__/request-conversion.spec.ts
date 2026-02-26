import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  listConvertedRequests,
  appendActivityToRequest,
  recordConversionOrder,
  getRequestConversionStatus,
  calculateConversionStats,
} from '../request-conversion'
import * as client from '../client'

// Mock apiClient
vi.mock('../client', () => ({
  apiClient: {
    get: vi.fn(),
    put: vi.fn(),
  },
}))

describe('request-conversion API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ========== listConvertedRequests ==========
  describe('listConvertedRequests', () => {
    it('應查詢有轉化活動的諮詢', async () => {
      const mockResponse = {
        data: {
          records: [
            {
              R_Request_ID: 1,
              Summary: '轉化諮詢',
              Created: '2026-02-20T09:00:00Z',
              Description: JSON.stringify([
                {
                  actionType: 'ConversionOrder',
                  linkedOrderId: 100,
                  timestamp: '2026-02-24T16:30:00Z',
                },
              ]),
            },
            {
              R_Request_ID: 2,
              Summary: '未轉化諮詢',
              Created: '2026-02-21T10:00:00Z',
              Description: JSON.stringify([
                {
                  actionType: 'PhoneCall',
                  timestamp: '2026-02-21T10:30:00Z',
                },
              ]),
            },
          ],
        },
      }

      vi.spyOn(client.apiClient, 'get').mockResolvedValue(mockResponse)

      const result = await listConvertedRequests()

      // 應該只返回有轉化活動的諮詢
      expect(result).toHaveLength(1)
      expect(result[0].R_Request_ID).toBe(1)
    })

    it('應支援日期範圍篩選', async () => {
      const mockResponse = { data: { records: [] } }
      vi.spyOn(client.apiClient, 'get').mockResolvedValue(mockResponse)

      await listConvertedRequests('2026-02-01T00:00:00Z', '2026-02-28T23:59:59Z')

      // 驗證查詢參數包含日期過濾
      expect(client.apiClient.get).toHaveBeenCalledWith(
        '/api/v1/models/R_Request',
        expect.objectContaining({
          params: expect.objectContaining({
            $filter: expect.stringContaining('Created ge datetime'),
          }),
        })
      )
    })

    it('應處理無效 JSON Description', async () => {
      const mockResponse = {
        data: {
          records: [
            {
              R_Request_ID: 1,
              Description: 'invalid json',
            },
            {
              R_Request_ID: 2,
              Description: null,
            },
          ],
        },
      }

      vi.spyOn(client.apiClient, 'get').mockResolvedValue(mockResponse)

      const result = await listConvertedRequests()

      // 應該篩選出所有無效的記錄
      expect(result).toHaveLength(0)
    })
  })

  // ========== appendActivityToRequest ==========
  describe('appendActivityToRequest', () => {
    it('應添加新活動到現有活動列表', async () => {
      const existingActivity = {
        timestamp: '2026-02-20T10:00:00Z',
        actionType: 'PhoneCall',
        content: '初始活動',
        createdBy: 1000,
      }

      const mockGetResponse = {
        data: {
          R_Request_ID: 1,
          Description: JSON.stringify([existingActivity]),
        },
      }

      const newActivity = {
        timestamp: '2026-02-21T14:00:00Z',
        actionType: 'Message',
        content: '新活動',
        createdBy: 1001,
        type: 'Activity' as const,
      }

      vi.spyOn(client.apiClient, 'get').mockResolvedValue(mockGetResponse)
      vi.spyOn(client.apiClient, 'put').mockResolvedValue({
        data: { R_Request_ID: 1 },
      })

      await appendActivityToRequest(1, newActivity)

      // 驗證 PUT 呼叫時包含兩個活動
      const putCall = (client.apiClient.put as any).mock.calls[0]
      const updatedData = putCall[1]
      const activities = JSON.parse(updatedData.Description)

      expect(activities).toHaveLength(2)
      expect(activities[1].actionType).toBe('Message')
    })

    it('應自動生成活動 ID', async () => {
      vi.spyOn(client.apiClient, 'get').mockResolvedValue({
        data: { R_Request_ID: 1, Description: '[]' },
      })

      vi.spyOn(client.apiClient, 'put').mockResolvedValue({
        data: { R_Request_ID: 1 },
      })

      const activity = {
        timestamp: '2026-02-20T10:00:00Z',
        actionType: 'PhoneCall',
        content: 'Test',
        createdBy: 1000,
        type: 'Activity' as const,
      }

      await appendActivityToRequest(1, activity)

      const putCall = (client.apiClient.put as any).mock.calls[0]
      const updatedData = putCall[1]
      const activities = JSON.parse(updatedData.Description)

      expect(activities[0].id).toBeDefined()
      expect(activities[0].id).toMatch(/^act-/)
    })
  })

  // ========== recordConversionOrder ==========
  describe('recordConversionOrder', () => {
    it('應記錄轉化訂單活動', async () => {
      vi.spyOn(client.apiClient, 'get').mockResolvedValue({
        data: { R_Request_ID: 1, Description: '[]' },
      })

      vi.spyOn(client.apiClient, 'put').mockResolvedValue({
        data: { R_Request_ID: 1 },
      })

      await recordConversionOrder(1, 100, 'ORD-2026-001', 1000)

      const putCall = (client.apiClient.put as any).mock.calls[0]
      const updatedData = putCall[1]
      const activities = JSON.parse(updatedData.Description)

      expect(activities[0].actionType).toBe('ConversionOrder')
      expect(activities[0].linkedOrderId).toBe(100)
      expect(activities[0].linkedOrderNo).toBe('ORD-2026-001')
      expect(activities[0].createdBy).toBe(1000)
    })
  })

  // ========== getRequestConversionStatus ==========
  describe('getRequestConversionStatus', () => {
    it('應查詢已轉化的狀態', async () => {
      const conversionActivity = {
        timestamp: '2026-02-24T16:30:00Z',
        actionType: 'ConversionOrder',
        linkedOrderId: 100,
        linkedOrderNo: 'ORD-2026-001',
        createdBy: 1000,
      }

      vi.spyOn(client.apiClient, 'get').mockResolvedValue({
        data: {
          R_Request_ID: 1,
          Created: '2026-02-20T09:00:00Z',
          Description: JSON.stringify([conversionActivity]),
        },
      })

      const status = await getRequestConversionStatus(1)

      expect(status.isConverted).toBe(true)
      expect(status.orderId).toBe(100)
      expect(status.orderNo).toBe('ORD-2026-001')
      expect(status.conversionTime).toBe('2026-02-24T16:30:00Z')
    })

    it('應查詢未轉化的狀態', async () => {
      vi.spyOn(client.apiClient, 'get').mockResolvedValue({
        data: {
          R_Request_ID: 1,
          Description: JSON.stringify([]),
        },
      })

      const status = await getRequestConversionStatus(1)

      expect(status.isConverted).toBe(false)
      expect(status.orderId).toBeUndefined()
    })
  })

  // ========== calculateConversionStats ==========
  describe('calculateConversionStats', () => {
    it('應計算轉化統計', () => {
      const requests = [
        {
          R_Request_ID: 1,
          Created: '2026-02-20T09:00:00Z',
          Description: JSON.stringify([
            {
              actionType: 'ConversionOrder',
              timestamp: '2026-02-24T16:30:00Z',
            },
          ]),
        },
        {
          R_Request_ID: 2,
          Created: '2026-02-21T10:00:00Z',
          Description: JSON.stringify([]),
        },
      ]

      const stats = calculateConversionStats(requests)

      expect(stats.totalCount).toBe(2)
      expect(stats.convertedCount).toBe(1)
      expect(stats.conversionRate).toBe('50.0%')
      expect(stats.avgConversionDays).not.toBe('-')
    })

    it('應處理空請求列表', () => {
      const stats = calculateConversionStats([])

      expect(stats.totalCount).toBe(0)
      expect(stats.convertedCount).toBe(0)
      expect(stats.conversionRate).toBe('0%')
      expect(stats.avgConversionDays).toBe('-')
    })
  })
})
