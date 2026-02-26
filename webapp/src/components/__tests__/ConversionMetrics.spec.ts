import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import ConversionMetrics from '../ConversionMetrics.vue'

describe('ConversionMetrics', () => {
  // 測試數據
  const mockRequests = [
    {
      R_Request_ID: 5000,
      C_BPartner_ID: 1000,
      Created: '2026-02-20T09:00:00Z',
      Summary: '諮詢隆鼻療程',
      Description: JSON.stringify([
        {
          timestamp: '2026-02-20T09:30:00Z',
          type: 'Activity',
          actionType: 'PhoneCall',
          content: '首次通話，介紹療程',
          createdBy: 1001,
          id: 'act-001',
        },
        {
          timestamp: '2026-02-24T16:30:00Z',
          type: 'StatusChange',
          actionType: 'ConversionOrder',
          content: '轉化為訂單 #ORD-2026-0001',
          createdBy: 1001,
          linkedOrderId: 1000001,
          linkedOrderNo: 'ORD-2026-0001',
          id: 'act-002',
        },
      ]),
    },
    {
      R_Request_ID: 5001,
      C_BPartner_ID: 1001,
      Created: '2026-02-21T10:00:00Z',
      Summary: '諮詢除皺療程',
      Description: JSON.stringify([
        {
          timestamp: '2026-02-21T10:30:00Z',
          type: 'Activity',
          actionType: 'PhoneCall',
          content: '客戶詢問價格',
          createdBy: 1002,
          id: 'act-003',
        },
      ]),
    },
    {
      R_Request_ID: 5002,
      C_BPartner_ID: 1002,
      Created: '2026-02-18T08:00:00Z',
      Summary: '諮詢脂肪填充',
      Description: JSON.stringify([
        {
          timestamp: '2026-02-18T14:00:00Z',
          type: 'Activity',
          actionType: 'PhoneCall',
          content: '初步諮詢',
          createdBy: 1002,
          id: 'act-004',
        },
        {
          timestamp: '2026-02-20T15:00:00Z',
          type: 'Activity',
          actionType: 'Message',
          content: '客戶發訊息確認',
          createdBy: 1001,
          id: 'act-005',
        },
        {
          timestamp: '2026-02-22T16:00:00Z',
          type: 'StatusChange',
          actionType: 'ConversionOrder',
          content: '轉化為訂單 #ORD-2026-0002',
          createdBy: 1001,
          linkedOrderId: 1000002,
          linkedOrderNo: 'ORD-2026-0002',
          id: 'act-006',
        },
      ]),
    },
  ]

  const mockOperatorNames = {
    1001: 'Jenny',
    1002: 'JERRY',
  }

  // ========== 測試：轉化率計算 ==========
  describe('轉化率計算', () => {
    it('應正確計算轉化率：2/3 = 66.7%', () => {
      const wrapper = mount(ConversionMetrics, {
        props: {
          requests: mockRequests,
          operatorNames: mockOperatorNames,
        },
      })

      expect(wrapper.vm.metrics.conversionRate).toBe('66.7%')
      expect(wrapper.vm.metrics.convertedCount).toBe(2)
      expect(wrapper.vm.metrics.totalCount).toBe(3)
    })

    it('當無諮詢時，轉化率應為 0%', () => {
      const wrapper = mount(ConversionMetrics, {
        props: {
          requests: [],
          operatorNames: mockOperatorNames,
        },
      })

      expect(wrapper.vm.metrics.conversionRate).toBe('0%')
      expect(wrapper.vm.metrics.convertedCount).toBe(0)
    })

    it('當全部已轉化時，轉化率應為 100%', () => {
      const allConverted = mockRequests.filter(r => r.R_Request_ID !== 5001)
      const wrapper = mount(ConversionMetrics, {
        props: {
          requests: allConverted,
          operatorNames: mockOperatorNames,
        },
      })

      expect(wrapper.vm.metrics.conversionRate).toBe('100.0%')
    })

    it('應正確處理無效 JSON Description', () => {
      const invalidRequests = [
        {
          R_Request_ID: 5003,
          C_BPartner_ID: 1003,
          Created: '2026-02-25T09:00:00Z',
          Summary: '測試',
          Description: 'invalid json',
        },
        ...mockRequests,
      ]

      const wrapper = mount(ConversionMetrics, {
        props: {
          requests: invalidRequests,
          operatorNames: mockOperatorNames,
        },
      })

      // 應該忽略無效的 JSON，計算其他的
      expect(wrapper.vm.metrics.totalCount).toBe(4)
    })
  })

  // ========== 測試：平均轉化時間 ==========
  describe('平均轉化時間計算', () => {
    it('應正確計算平均轉化時間', () => {
      const wrapper = mount(ConversionMetrics, {
        props: {
          requests: mockRequests,
          operatorNames: mockOperatorNames,
        },
      })

      // 5000: 2026-02-20 09:00 → 2026-02-24 16:30 = 4.3125 天
      // 5002: 2026-02-18 08:00 → 2026-02-22 16:00 = 4.333 天
      // 平均 ≈ 4.3 天
      expect(wrapper.vm.metrics.avgConversionTime).toContain('4.')
    })

    it('當無轉化諮詢時，平均時間應為 "-"', () => {
      const noConverted = [mockRequests[1]]
      const wrapper = mount(ConversionMetrics, {
        props: {
          requests: noConverted,
          operatorNames: mockOperatorNames,
        },
      })

      expect(wrapper.vm.metrics.avgConversionTime).toBe('-')
    })
  })

  // ========== 測試：待轉化諮詢 ==========
  describe('待轉化諮詢計算（>7 天未轉化）', () => {
    it('應計算超過 7 天未轉化的諮詢', () => {
      const now = new Date()
      const eightDaysAgo = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString()

      const pending = [
        {
          R_Request_ID: 5004,
          C_BPartner_ID: 1004,
          Created: eightDaysAgo, // 8 天前
          Summary: '待轉化',
          Description: JSON.stringify([
            {
              timestamp: eightDaysAgo,
              type: 'Activity',
              actionType: 'PhoneCall',
              content: '初步諮詢',
              createdBy: 1001,
              id: 'act-007',
            },
          ]),
        },
      ]

      const wrapper = mount(ConversionMetrics, {
        props: {
          requests: pending,
          operatorNames: mockOperatorNames,
        },
      })

      expect(wrapper.vm.metrics.pendingConversionCount).toBe(1)
    })

    it('應忽略少於 7 天的諮詢', () => {
      const now = new Date()
      const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString()

      const recent = [
        {
          R_Request_ID: 5005,
          C_BPartner_ID: 1005,
          Created: fiveDaysAgo, // 5 天前
          Summary: '最近諮詢',
          Description: JSON.stringify([]),
        },
      ]

      const wrapper = mount(ConversionMetrics, {
        props: {
          requests: recent,
          operatorNames: mockOperatorNames,
        },
      })

      expect(wrapper.vm.metrics.pendingConversionCount).toBe(0)
    })
  })

  // ========== 測試：操作人績效 ==========
  describe('操作人績效統計', () => {
    it('應正確統計操作人績效', () => {
      const wrapper = mount(ConversionMetrics, {
        props: {
          requests: mockRequests,
          operatorNames: mockOperatorNames,
        },
      })

      const performance = wrapper.vm.metrics.operatorPerformance

      // Jenny (1001): 操作 2 個諮詢（5000, 5002），轉化 2 個
      const jenny = performance.find((op: any) => op.operatorId === 1001)
      expect(jenny).toBeDefined()
      expect(jenny.consultationsUpdated).toBe(2)
      expect(jenny.conversionsCreated).toBe(2)
      expect(jenny.conversionRate).toBe('100.0%')

      // JERRY (1002): 操作 2 個諮詢（5001, 5002），轉化 0 個
      // 注意: 5001 只有第一個活動是 JERRY 操作，但沒有轉化
      // 5002 的第一個活動是 JERRY，但轉化是 Jenny 操作的
      const jerry = performance.find((op: any) => op.operatorId === 1002)
      expect(jerry).toBeDefined()
      expect(jerry.consultationsUpdated).toBe(2)
      expect(jerry.conversionsCreated).toBe(0) // 修正：JERRY 沒有轉化任何訂單
      expect(jerry.conversionRate).toBe('0.0%')
    })

    it('應正確使用操作人名稱', () => {
      const wrapper = mount(ConversionMetrics, {
        props: {
          requests: mockRequests,
          operatorNames: mockOperatorNames,
        },
      })

      const performance = wrapper.vm.metrics.operatorPerformance
      const jenny = performance.find((op: any) => op.operatorId === 1001)
      expect(jenny.operatorName).toBe('Jenny')
    })

    it('應使用預設名稱當無提供操作人名稱', () => {
      const wrapper = mount(ConversionMetrics, {
        props: {
          requests: mockRequests,
          operatorNames: {}, // 空物件
        },
      })

      const performance = wrapper.vm.metrics.operatorPerformance
      const defaultName = performance.find((op: any) => op.operatorId === 1001)
      expect(defaultName.operatorName).toContain('用戶')
    })

    it('應計算平均響應時間', () => {
      const wrapper = mount(ConversionMetrics, {
        props: {
          requests: mockRequests,
          operatorNames: mockOperatorNames,
        },
      })

      const performance = wrapper.vm.metrics.operatorPerformance
      const jenny = performance.find((op: any) => op.operatorId === 1001)

      // 響應時間應為正數小時
      expect(jenny.avgResponseTime).not.toBe('-')
      expect(jenny.avgResponseTime).toMatch(/\d+\.\d+h/)
    })
  })

  // ========== 測試：動態更新 ==========
  describe('動態更新', () => {
    it('當 requests prop 更新時，應重新計算指標', async () => {
      const wrapper = mount(ConversionMetrics, {
        props: {
          requests: [mockRequests[0]], // 初始 1 個
          operatorNames: mockOperatorNames,
        },
      })

      expect(wrapper.vm.metrics.totalCount).toBe(1)

      // 更新 requests
      await wrapper.setProps({
        requests: mockRequests, // 更新為 3 個
      })

      expect(wrapper.vm.metrics.totalCount).toBe(3)
      expect(wrapper.vm.metrics.conversionRate).toBe('66.7%')
    })

    it('應在 operatorNames 完整提供時使用自訂名稱', () => {
      const fullOperatorNames = {
        1001: 'Jenny',
        1002: 'JERRY',
        1003: 'Admin',
      }

      const wrapper = mount(ConversionMetrics, {
        props: {
          requests: mockRequests,
          operatorNames: fullOperatorNames,
        },
      })

      const performance = wrapper.vm.metrics.operatorPerformance
      const jenny = performance.find((op: any) => op.operatorId === 1001)
      const jerry = performance.find((op: any) => op.operatorId === 1002)

      // 驗證名稱來自 operatorNames prop
      expect(jenny.operatorName).toBe('Jenny')
      expect(jerry.operatorName).toBe('JERRY')
    })
  })

  // ========== 邊界情況 ==========
  describe('邊界情況', () => {
    it('應處理空 Description 欄位', () => {
      const emptyDesc = [
        {
          R_Request_ID: 5010,
          C_BPartner_ID: 1010,
          Created: '2026-02-26T09:00:00Z',
          Summary: '測試',
          Description: '', // 空字符串
        },
      ]

      const wrapper = mount(ConversionMetrics, {
        props: {
          requests: emptyDesc,
          operatorNames: mockOperatorNames,
        },
      })

      expect(wrapper.vm.metrics.convertedCount).toBe(0)
      expect(wrapper.vm.metrics.conversionRate).toBe('0.0%')
    })

    it('應處理 null Description 欄位', () => {
      const nullDesc = [
        {
          R_Request_ID: 5011,
          C_BPartner_ID: 1011,
          Created: '2026-02-26T09:00:00Z',
          Summary: '測試',
          Description: null,
        },
      ]

      const wrapper = mount(ConversionMetrics, {
        props: {
          requests: nullDesc,
          operatorNames: mockOperatorNames,
        },
      })

      expect(wrapper.vm.metrics.totalCount).toBe(1)
      expect(wrapper.vm.metrics.convertedCount).toBe(0)
    })
  })
})
