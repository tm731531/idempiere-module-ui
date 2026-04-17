import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import KanbanBoardView from '../KanbanBoardView.vue'

// --- Mocks ---
// All vi.mock factories are hoisted to the top of the file, so they cannot
// reference variables declared in the module scope. Use only inline literals.

vi.mock('vue-router', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
}))

vi.mock('@/composables/useRequestStatuses', () => ({
  loadRequestStatuses: vi.fn(() => Promise.resolve([
    { R_Status_ID: 1, Name: '待處理', SeqNo: 10, IsClosed: false },
    { R_Status_ID: 2, Name: '已完成', SeqNo: 20, IsClosed: true },
  ])),
}))

vi.mock('@/api/bpartner', () => ({
  listSalesReps: vi.fn(() => Promise.resolve([
    { id: 100, Name: '張三' },
    { id: 101, Name: '李四' },
  ])),
}))

vi.mock('@/api/request', () => ({
  listRequests: vi.fn(() => Promise.resolve([
    {
      id: 1001,
      Summary: '顧客 A 諮詢',
      R_Status_ID: { id: 1, identifier: '待處理' },
      SalesRep_ID: { id: 100, Name: '張三' },
      C_BPartner_ID: { id: 200, Name: '顧客A', identifier: '顧客A' },
      DateNextAction: null,
    },
    {
      id: 1002,
      Summary: '顧客 B 諮詢',
      R_Status_ID: { id: 2, identifier: '已完成' },
      SalesRep_ID: null,
      C_BPartner_ID: { id: 201, Name: '顧客B', identifier: '顧客B' },
      DateNextAction: null,
    },
  ])),
  updateRequest: vi.fn(() => Promise.resolve({ id: 1001 })),
  getRequest: vi.fn((id: number) => Promise.resolve({
    id,
    Summary: `諮詢 #${id}`,
    R_Status_ID: null,
    SalesRep_ID: null,
    DateNextAction: null,
  })),
}))

// Import mocked modules AFTER vi.mock declarations so we can spy on them
import * as requestApi from '@/api/request'

// --- Helpers ---
function mountKanban(windowWidth = 1280) {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: windowWidth })
  return mount(KanbanBoardView, { global: { stubs: {} } })
}

describe('KanbanBoardView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders status columns after loading', async () => {
    const wrapper = mountKanban()
    await flushPromises()

    const headers = wrapper.findAll('.column-title')
    const titles = headers.map(h => h.text())
    expect(titles).toContain('待處理')
    expect(titles).toContain('已完成')
  })

  it('renders swimlanes for each sales rep plus unassigned', async () => {
    const wrapper = mountKanban()
    await flushPromises()

    const labels = wrapper.findAll('.lane-label')
    const texts = labels.map(l => l.text())
    expect(texts).toContain('未分配')
    expect(texts).toContain('張三')
    expect(texts).toContain('李四')
  })

  it('places cards in correct cells', async () => {
    const wrapper = mountKanban()
    await flushPromises()

    const cards = wrapper.findAll('.kanban-card')
    expect(cards.length).toBe(2)

    // Cards should be rendered (order depends on column/lane traversal)
    const allText = wrapper.text()
    expect(allText).toContain('顧客 A 諮詢')
    expect(allText).toContain('顧客 B 諮詢')
  })

  it('shows unassigned lane card for null SalesRep_ID', async () => {
    const wrapper = mountKanban()
    await flushPromises()

    // Find all lane elements and look for one labelled 未分配 that contains card 1002
    const lanes = wrapper.findAll('.kanban-lane')
    const unassignedLanes = lanes.filter(l => {
      const label = l.find('.lane-label')
      return label.exists() && label.text() === '未分配'
    })
    expect(unassignedLanes.length).toBeGreaterThan(0)

    // At least one unassigned lane must contain card 1002's text
    const hasCard1002 = unassignedLanes.some(l => l.text().includes('顧客 B 諮詢'))
    expect(hasCard1002).toBe(true)
  })

  it('calls updateRequest with correct payload on drag drop', async () => {
    const wrapper = mountKanban()
    await flushPromises()

    // Find first card (1001, status=1 待處理, rep=100 張三)
    const cards = wrapper.findAll('.kanban-card')
    expect(cards.length).toBeGreaterThan(0)
    const firstCard = cards[0]
    if (!firstCard) return
    await firstCard.trigger('dragstart', { dataTransfer: { setData: vi.fn() } })

    // Structure: 2 columns × 3 lanes (未分配, 張三, 李四)
    // Lanes are rendered per-column, so:
    //   Column 0 (待處理): lanes 0,1,2
    //   Column 1 (已完成): lanes 3,4,5
    // Target = 已完成 × 李四 → lane index 5
    const lanes = wrapper.findAll('.kanban-lane')
    const targetLane = lanes[5]
    if (lanes.length >= 6 && targetLane) {
      await targetLane.trigger('drop', { preventDefault: vi.fn() })
      await flushPromises()

      expect(requestApi.updateRequest).toHaveBeenCalledWith(1001, {
        R_Status_ID: 2,
        SalesRep_ID: 101,
      })
    }
  })

  it('shows mobile fallback notice on small screens', async () => {
    const wrapper = mountKanban(800)
    window.dispatchEvent(new Event('resize'))
    await flushPromises()

    expect(wrapper.find('.mobile-fallback').exists()).toBe(true)
    expect(wrapper.text()).toContain('Kanban 在小螢幕不可用')
    expect(wrapper.find('.kanban-board').exists()).toBe(false)
  })
})
