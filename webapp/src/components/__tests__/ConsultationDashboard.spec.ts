import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ConsultationDashboard from '../ConsultationDashboard.vue'

describe('ConsultationDashboard', () => {
  // Use noon-based timestamps inside the current month so totalThisMonth is
  // deterministic. toISOString() gives UTC-midnight which parseIdempiereDateTime
  // treats as local time — in UTC+8 that shifts the date back one day.
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const ym = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`
  const monthStart = `${ym}-01T12:00:00Z`
  const monthMid = `${ym}-${pad(Math.min(15, now.getDate()))}T12:00:00Z`
  const monthLate = `${ym}-${pad(Math.min(20, now.getDate()))}T12:00:00Z`

  const mockRequests = [
    {
      id: 1,
      Created: monthStart,
      R_Status_ID: { id: 1, IsClosed: false, Name: '待處理' },
      C_BPartner_ID: { id: 1, Name: '客戶A' },
    },
    {
      id: 2,
      Created: monthMid,
      R_Status_ID: { id: 2, IsClosed: false, Name: '討論中' },
      C_BPartner_ID: { id: 2, Name: '客戶B' },
    },
    {
      id: 3,
      Created: monthLate,
      R_Status_ID: { id: 3, IsClosed: true, Name: '已完成' },
      C_BPartner_ID: { id: 1, Name: '客戶A' },
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
