import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import CustomerHistorySidebar from '../CustomerHistorySidebar.vue'

// Mock API modules
vi.mock('@/api/request', () => ({
  listRequests: vi.fn(),
}))
vi.mock('@/api/assignment', () => ({
  listAssignmentsByCustomer: vi.fn(),
}))
vi.mock('@/api/order', () => ({
  listOrders: vi.fn(),
}))
vi.mock('@/api/utils', () => ({
  parseIdempiereDateTime: (s: string) => new Date(s),
}))

import { listRequests } from '@/api/request'
import { listAssignmentsByCustomer } from '@/api/assignment'
import { listOrders } from '@/api/order'

const mockRouter = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', component: { template: '<div/>' } },
    { path: '/consultation/:id', name: 'consultation-edit', component: { template: '<div/>' } },
    { path: '/appointment', name: 'appointment-calendar', component: { template: '<div/>' } },
    { path: '/order/:id', name: 'order-detail', component: { template: '<div/>' } },
  ],
})

const mockConsultations = [
  {
    id: 1001,
    R_Request_ID: 1001,
    Summary: '隆鼻諮詢',
    LastResult: '待處理',
    Created: '2026-01-15T10:00:00Z',
  },
  {
    id: 1002,
    R_Request_ID: 1002,
    Summary: '除皺諮詢',
    R_Status_ID: { id: 5, identifier: '已完成' },
    Created: '2026-01-20T10:00:00Z',
  },
]

const mockAppointments = [
  {
    id: 2001,
    S_ResourceAssignment_ID: 2001,
    Name: '術前諮詢',
    S_Resource_ID: { id: 10, identifier: 'Dr. Chen', Name: 'Dr. Chen' },
    AssignDateFrom: '2026-02-01T09:00:00Z',
  },
]

const mockOrders = [
  {
    id: 3001,
    C_Order_ID: 3001,
    DocumentNo: 'SO-2026-001',
    GrandTotal: 15000,
    DateOrdered: '2026-01-25T00:00:00Z',
    DocStatus: { id: 'CO', identifier: '已完成' },
  },
]

describe('CustomerHistorySidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(listRequests as any).mockResolvedValue(mockConsultations)
    ;(listAssignmentsByCustomer as any).mockResolvedValue(mockAppointments)
    ;(listOrders as any).mockResolvedValue(mockOrders)
  })

  function mountSidebar(props: Record<string, any> = {}) {
    return mount(CustomerHistorySidebar, {
      props: {
        customerId: 100,
        customerName: '測試客戶',
        ...props,
      },
      global: {
        plugins: [mockRouter],
      },
    })
  }

  it('renders three accordion sections', () => {
    const wrapper = mountSidebar()
    const headers = wrapper.findAll('.accordion-header')
    expect(headers.length).toBe(3)
    expect(headers[0]!.text()).toContain('諮詢')
    expect(headers[1]!.text()).toContain('預約')
    expect(headers[2]!.text()).toContain('訂單')
  })

  it('shows customer name badge', () => {
    const wrapper = mountSidebar({ customerName: '王小明' })
    expect(wrapper.find('.customer-name-badge').text()).toBe('王小明')
  })

  it('shows no-customer message when customerId is null', () => {
    const wrapper = mountSidebar({ customerId: null })
    expect(wrapper.text()).toContain('請先選擇客戶')
  })

  it('loads consultations on mount and renders them', async () => {
    const wrapper = mountSidebar()
    await flushPromises()

    // Consultations section is open by default
    const rows = wrapper.findAll('.accordion-body .history-row')
    expect(rows.length).toBeGreaterThanOrEqual(2)
    expect(wrapper.text()).toContain('隆鼻諮詢')
    expect(wrapper.text()).toContain('除皺諮詢')
  })

  it('shows empty state when no consultations', async () => {
    ;(listRequests as any).mockResolvedValue([])
    const wrapper = mountSidebar()
    await flushPromises()

    expect(wrapper.text()).toContain('該客戶尚無諮詢記錄')
  })

  it('loads appointments when section is toggled open', async () => {
    const wrapper = mountSidebar()
    await flushPromises()

    // Appointments section is closed by default, click to open
    const headers = wrapper.findAll('.accordion-header')
    await headers[1]!.trigger('click')
    await flushPromises()

    expect(listAssignmentsByCustomer).toHaveBeenCalledWith(100, 10)
    expect(wrapper.text()).toContain('術前諮詢')
  })

  it('loads orders when section is toggled open', async () => {
    const wrapper = mountSidebar()
    await flushPromises()

    const headers = wrapper.findAll('.accordion-header')
    await headers[2]!.trigger('click')
    await flushPromises()

    expect(listOrders).toHaveBeenCalledWith('C_BPartner_ID eq 100', 10)
    expect(wrapper.text()).toContain('SO-2026-001')
  })

  it('highlights current record', async () => {
    const wrapper = mountSidebar({
      currentRecordId: 1001,
      currentRecordType: 'consultation',
    })
    await flushPromises()

    const currentRows = wrapper.findAll('.current-record')
    expect(currentRows.length).toBe(1)
  })

  it('collapses and expands sidebar via toggle button', async () => {
    const wrapper = mountSidebar()

    // Sidebar should be expanded by default
    expect(wrapper.find('.sidebar-content').exists()).toBe(true)

    // Click toggle to collapse
    await wrapper.find('.sidebar-toggle').trigger('click')
    expect(wrapper.find('.sidebar-content').exists()).toBe(false)

    // Click again to expand
    await wrapper.find('.sidebar-toggle').trigger('click')
    expect(wrapper.find('.sidebar-content').exists()).toBe(true)
  })

  it('reloads data when customerId changes', async () => {
    const wrapper = mountSidebar({ customerId: 100 })
    await flushPromises()

    expect(listRequests).toHaveBeenCalledWith('C_BPartner_ID eq 100', 10)

    await wrapper.setProps({ customerId: 200 })
    await flushPromises()

    expect(listRequests).toHaveBeenCalledWith('C_BPartner_ID eq 200', 10)
  })
})
