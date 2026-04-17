import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ConversionMetrics from '../ConversionMetrics.vue'

describe('ConversionMetrics', () => {
  // Fixtures use R_Status_ID (with IsClosed) for conversion detection and
  // SalesRep_ID for operator identification — matching the post-migration component.
  const STATUS_CONVERTED = { id: 1, IsClosed: true, Name: '已轉化' }
  const STATUS_PENDING = { id: 2, IsClosed: false, Name: '待處理' }

  const mockRequests = [
    {
      R_Request_ID: 5000,
      C_BPartner_ID: { id: 1000, Name: '客戶A' },
      SalesRep_ID: { id: 1001, Name: 'Jenny' },
      Created: '2026-02-20T09:00:00Z',
      Updated: '2026-02-24T16:30:00Z',
      R_Status_ID: { ...STATUS_CONVERTED },
    },
    {
      R_Request_ID: 5001,
      C_BPartner_ID: { id: 1001, Name: '客戶B' },
      SalesRep_ID: { id: 1002, Name: 'JERRY' },
      Created: '2026-02-21T10:00:00Z',
      Updated: '2026-02-21T10:30:00Z',
      R_Status_ID: { ...STATUS_PENDING },
    },
    {
      R_Request_ID: 5002,
      C_BPartner_ID: { id: 1002, Name: '客戶C' },
      SalesRep_ID: { id: 1001, Name: 'Jenny' },
      Created: '2026-02-18T08:00:00Z',
      Updated: '2026-02-22T16:00:00Z',
      R_Status_ID: { ...STATUS_CONVERTED },
    },
  ]

  const mockOperatorNames = {
    1001: 'Jenny',
    1002: 'JERRY',
  }

  // 獲取轉化率文本（從第一個 metric-card 的 metric-value）
  function getConversionRateText(wrapper: any): string {
    const cards = wrapper.findAll('.metric-card')
    if (cards.length > 0) {
      const firstCard = cards[0]
      const value = firstCard.find('.metric-value')
      return value.text().trim()
    }
    return ''
  }

  // 獲取轉化詳情文本 (例如 "2/3 諮詢")
  function getConversionDetailText(wrapper: any): string {
    const cards = wrapper.findAll('.metric-card')
    if (cards.length > 0) {
      const firstCard = cards[0]
      const detail = firstCard.find('.metric-detail')
      return detail.text().trim()
    }
    return ''
  }

  // 獲取平均轉化時間文本
  function getAvgConversionTimeText(wrapper: any): string {
    const cards = wrapper.findAll('.metric-card')
    if (cards.length > 1) {
      const secondCard = cards[1]
      const value = secondCard.find('.metric-value')
      return value.text().trim()
    }
    return ''
  }

  // 獲取待轉化計數文本
  function getPendingCountText(wrapper: any): string {
    const cards = wrapper.findAll('.metric-card')
    if (cards.length > 2) {
      const thirdCard = cards[2]
      const value = thirdCard.find('.metric-value')
      return value.text().trim()
    }
    return ''
  }

  // 從績效表獲取操作人數據
  function getPerformanceData(wrapper: any): any[] {
    const rows = wrapper.findAll('.performance-table tbody tr')
    return rows.map((row: any) => {
      const cells = row.findAll('td')
      if (cells.length >= 5) {
        return {
          name: cells[1].text().trim(),
          consultationsUpdated: parseInt(cells[2].text().trim()),
          conversionsCreated: parseInt(cells[3].text().trim()),
          conversionRate: cells[4].text().trim(),
        }
      }
      return null
    }).filter((data: any) => data !== null)
  }

  // ========== 測試：轉化率計算 ==========
  describe('轉化率計算', () => {
    it('應正確計算轉化率：2/3 = 66.7%', async () => {
      const wrapper = mount(ConversionMetrics, {
        props: {
          requests: mockRequests,
          operatorNames: mockOperatorNames,
        },
      })
      await flushPromises()

      expect(getConversionRateText(wrapper)).toBe('66.7%')
      expect(getConversionDetailText(wrapper)).toContain('2/3')
    })

    it('當無諮詢時，轉化率應為 0%', async () => {
      const wrapper = mount(ConversionMetrics, {
        props: {
          requests: [],
          operatorNames: mockOperatorNames,
        },
      })
      await flushPromises()

      expect(getConversionRateText(wrapper)).toBe('0%')
      expect(getConversionDetailText(wrapper)).toContain('0/0')
    })

    it('當全部已轉化時，轉化率應為 100%', async () => {
      const allConverted = mockRequests.filter(r => r.R_Request_ID !== 5001)
      const wrapper = mount(ConversionMetrics, {
        props: {
          requests: allConverted,
          operatorNames: mockOperatorNames,
        },
      })
      await flushPromises()

      expect(getConversionRateText(wrapper)).toBe('100.0%')
    })

    it('應正確處理無效 JSON Description', async () => {
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
      await flushPromises()

      // 應該忽略無效的 JSON，計算其他的
      expect(getConversionDetailText(wrapper)).toContain('4')
    })
  })

  // ========== 測試：平均轉化時間 ==========
  describe('平均轉化時間計算', () => {
    it('應正確計算平均轉化時間', async () => {
      const wrapper = mount(ConversionMetrics, {
        props: {
          requests: mockRequests,
          operatorNames: mockOperatorNames,
        },
      })
      await flushPromises()

      // Converted requests use Updated - Created:
      // 5000: 2026-02-20T09:00 → 2026-02-24T16:30 = 4.3125 天
      // 5002: 2026-02-18T08:00 → 2026-02-22T16:00 = 4.333 天
      // Average ≈ 4.3 天
      const timeText = getAvgConversionTimeText(wrapper)
      expect(timeText).toContain('4.')
    })

    it('當無轉化諮詢時，平均時間應為 "-"', async () => {
      const noConverted = [mockRequests[1]]
      const wrapper = mount(ConversionMetrics, {
        props: {
          requests: noConverted,
          operatorNames: mockOperatorNames,
        },
      })
      await flushPromises()

      const timeText = getAvgConversionTimeText(wrapper)
      expect(timeText).toBe('-')
    })
  })

  // ========== 測試：待轉化諮詢 ==========
  describe('待轉化諮詢計算（>7 天未轉化）', () => {
    it('應計算超過 7 天未轉化的諮詢', async () => {
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
      await flushPromises()

      const pendingText = getPendingCountText(wrapper)
      expect(pendingText).toBe('1')
    })

    it('應忽略少於 7 天的諮詢', async () => {
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
      await flushPromises()

      const pendingText = getPendingCountText(wrapper)
      expect(pendingText).toBe('0')
    })
  })

  // ========== 測試：操作人績效 ==========
  describe('操作人績效統計', () => {
    it('應正確統計操作人績效', async () => {
      const wrapper = mount(ConversionMetrics, {
        props: {
          requests: mockRequests,
          operatorNames: mockOperatorNames,
        },
      })
      await flushPromises()

      const performance = getPerformanceData(wrapper)

      // Jenny (1001): SalesRep on 5000 + 5002, both converted
      const jenny = performance.find((op: any) => op.name === 'Jenny')
      expect(jenny).toBeDefined()
      expect(jenny.consultationsUpdated).toBe(2)
      expect(jenny.conversionsCreated).toBe(2)
      expect(jenny.conversionRate).toBe('100.0%')

      // JERRY (1002): SalesRep on 5001 only (not converted)
      const jerry = performance.find((op: any) => op.name === 'JERRY')
      expect(jerry).toBeDefined()
      expect(jerry.consultationsUpdated).toBe(1)
      expect(jerry.conversionsCreated).toBe(0)
      expect(jerry.conversionRate).toBe('0.0%')
    })

    it('應正確使用操作人名稱', async () => {
      const wrapper = mount(ConversionMetrics, {
        props: {
          requests: mockRequests,
          operatorNames: mockOperatorNames,
        },
      })
      await flushPromises()

      const performance = getPerformanceData(wrapper)
      const jenny = performance.find((op: any) => op.name === 'Jenny')
      expect(jenny).toBeDefined()
      expect(jenny.name).toBe('Jenny')
    })

    it('應使用預設名稱當無提供操作人名稱', async () => {
      // Requests with no SalesRep_ID.Name and no operatorNames entry fall back to '用戶 #ID'
      const noNameRequests = [
        {
          R_Request_ID: 5090,
          C_BPartner_ID: { id: 1090, Name: '客戶X' },
          SalesRep_ID: { id: 9999 }, // no Name field
          Created: '2026-02-20T09:00:00Z',
          Updated: '2026-02-20T09:00:00Z',
          R_Status_ID: { id: 2, IsClosed: false },
        },
      ]
      const wrapper = mount(ConversionMetrics, {
        props: {
          requests: noNameRequests,
          operatorNames: {}, // 空物件
        },
      })
      await flushPromises()

      const performance = getPerformanceData(wrapper)
      expect(performance.length).toBeGreaterThan(0)
      expect(performance[0].name).toContain('用戶')
    })

    it('應計算平均響應時間', async () => {
      const wrapper = mount(ConversionMetrics, {
        props: {
          requests: mockRequests,
          operatorNames: mockOperatorNames,
        },
      })
      await flushPromises()

      const rows = wrapper.findAll('.performance-table tbody tr')
      expect(rows.length).toBeGreaterThan(0)

      // 檢查第一行的響應時間欄位（第6列）
      if (rows.length > 0 && rows[0]) {
        const cells = rows[0].findAll('td')
        if (cells.length >= 6 && cells[5]) {
          const responseTimeText = cells[5].text().trim()
          expect(responseTimeText).not.toBe('-')
          expect(responseTimeText).toMatch(/\d+\.\d+h/)
        }
      }
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
      await flushPromises()

      let detailText = getConversionDetailText(wrapper)
      expect(detailText).toContain('1/')

      // 更新 requests
      await wrapper.setProps({
        requests: mockRequests, // 更新為 3 個
      })
      await flushPromises()

      detailText = getConversionDetailText(wrapper)
      expect(detailText).toContain('2/3')
      expect(getConversionRateText(wrapper)).toBe('66.7%')
    })

    it('應在 operatorNames 完整提供時使用自訂名稱', async () => {
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
      await flushPromises()

      const performance = getPerformanceData(wrapper)
      const jenny = performance.find((op: any) => op.name === 'Jenny')
      const jerry = performance.find((op: any) => op.name === 'JERRY')

      // 驗證名稱來自 operatorNames prop
      expect(jenny).toBeDefined()
      if (jenny) {
        expect(jenny.name).toBe('Jenny')
      }
      expect(jerry).toBeDefined()
      if (jerry) {
        expect(jerry.name).toBe('JERRY')
      }
    })
  })

  // ========== 邊界情況 ==========
  describe('邊界情況', () => {
    it('應處理空 Description 欄位', async () => {
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
      await flushPromises()

      expect(getConversionDetailText(wrapper)).toContain('0/1')
      expect(getConversionRateText(wrapper)).toBe('0.0%')
    })

    it('應處理 null Description 欄位', async () => {
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
      await flushPromises()

      expect(getConversionDetailText(wrapper)).toContain('1')
      expect(getConversionDetailText(wrapper)).toContain('0/1')
    })
  })
})
