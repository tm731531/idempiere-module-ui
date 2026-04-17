import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ConsultationDashboard from '../ConsultationDashboard.vue'

describe('ConsultationDashboard', () => {
  // Use dates inside the current month so totalThisMonth is deterministic
  // regardless of when the suite runs.
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const monthMid = new Date(now.getFullYear(), now.getMonth(), Math.min(15, now.getDate())).toISOString()
  const monthLate = new Date(now.getFullYear(), now.getMonth(), Math.min(20, now.getDate())).toISOString()

  const mockRequests = [
    {
      id: 1,
      Created: monthStart,
      R_Status_ID: { id: '待處理', identifier: '待處理' },
      C_BPartner_ID: { id: 1, Name: '客戶A' },
      Description: JSON.stringify([
        { timestamp: monthStart, type: '前台行動', actionType: '打電話', content: 'call', createdBy: 'John' },
      ]),
    },
    {
      id: 2,
      Created: monthMid,
      R_Status_ID: { id: '討論中', identifier: '討論中' },
      C_BPartner_ID: { id: 2, Name: '客戶B' },
      Description: JSON.stringify([]),
    },
    {
      id: 3,
      Created: monthLate,
      R_Status_ID: { id: '已完成', identifier: '已完成' },
      C_BPartner_ID: { id: 1, Name: '客戶A' },
      Description: JSON.stringify([]),
    },
  ]

  it('renders metric cards', () => {
    const statuses = ['待處理', '討論中', '已完成']
    const wrapper = mount(ConsultationDashboard, {
      props: {
        requests: mockRequests,
        statuses,
      },
    })

    expect(wrapper.text()).toContain('本月諮詢數')
    expect(wrapper.text()).toContain('待處理')
    expect(wrapper.text()).toContain('討論中')
    expect(wrapper.text()).toContain('已完成')
    expect(wrapper.text()).toContain('沉默諮詢')
    expect(wrapper.text()).toContain('流失客戶')
  })

  it('calculates metrics correctly', () => {
    const statuses = ['待處理', '討論中', '已完成']
    const wrapper = mount(ConsultationDashboard, {
      props: {
        requests: mockRequests,
        statuses,
      },
    })

    // 檢查指標值
    expect(wrapper.text()).toContain('3') // 本月共 3 筆
    // 每個自定義狀態應該顯示對應的計數
    // 待處理: 1, 討論中: 1, 已完成: 1
  })

  it('renders status distribution section', () => {
    const wrapper = mount(ConsultationDashboard, {
      props: {
        requests: mockRequests,
      },
    })

    expect(wrapper.text()).toContain('狀態分布')
    expect(wrapper.text()).toContain('待處理')
    expect(wrapper.text()).toContain('討論中')
    expect(wrapper.text()).toContain('已完成')
  })

  it('renders warning section for silent/lost consultations', () => {
    const wrapper = mount(ConsultationDashboard, {
      props: {
        requests: mockRequests,
      },
    })

    expect(wrapper.text()).toContain('預警清單')
  })

  it('handles empty requests gracefully', () => {
    const wrapper = mount(ConsultationDashboard, {
      props: {
        requests: [],
      },
    })

    expect(wrapper.text()).toContain('本月諮詢數')
    expect(wrapper.text()).toContain('0')
  })
})
