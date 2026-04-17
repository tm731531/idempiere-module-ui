import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import TodayTodoView from '../TodayTodoView.vue'

// ---- Mock vue-router ----
const mockPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: vi.fn(() => ({ push: mockPush })),
  useRoute: vi.fn(() => ({ params: {}, query: {} })),
}))

// ---- Mock auth store ----
vi.mock('@/stores/auth', () => ({
  useAuthStore: vi.fn(() => ({
    user: { id: 0, name: 'TestUser', role: 'user' },
    context: null,
    isAuthenticated: true,
  })),
}))

// ---- Mock lookup: current user AD_User_ID ----
vi.mock('@/api/lookup', () => ({
  lookupCurrentUserId: vi.fn(() => Promise.resolve(1001)),
}))

// ---- Mock useRequestStatuses ----
vi.mock('@/composables/useRequestStatuses', () => ({
  loadRequestStatuses: vi.fn(() => Promise.resolve([])),
  isRequestCompleted: vi.fn((req: any) => {
    // Mark 'closed' status requests as completed
    return req?._completed === true
  }),
}))

// ---- Mock trackingBadge ----
vi.mock('@/utils/trackingBadge', () => ({
  getTrackingBadge: vi.fn((dateStr: string | null) => {
    if (!dateStr) return null
    if (dateStr.includes('2020')) return { text: '逾期 N 天', color: 'red' }
    return null
  }),
}))

// Fix time at 2026-05-10 12:00:00 local
const NOW = new Date(2026, 4, 10, 12, 0, 0)

/** Build a mock R_Request record */
function makeReq(overrides: Record<string, any>) {
  return {
    id: Math.random(),
    Summary: 'Test request',
    DateNextAction: null,
    Updated: '2026-05-10T08:00:00',
    Priority: 5,
    SalesRep_ID: { id: 1001, Name: 'TestUser' },
    C_BPartner_ID: { id: 200, Name: '客戶 A' },
    _completed: false,
    ...overrides,
  }
}

// ---- Mock listRequests ----
import { listRequests } from '@/api/request'
vi.mock('@/api/request', () => ({
  listRequests: vi.fn(),
}))

describe('TodayTodoView', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    mockPush.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders stat row with 4 cards showing correct counts', async () => {
    const mockData = [
      // overdue: DateNextAction yesterday
      makeReq({ id: 1, DateNextAction: '2026-05-09T09:00:00', _completed: false }),
      makeReq({ id: 2, DateNextAction: '2026-05-08T09:00:00', _completed: false }),
      // today
      makeReq({ id: 3, DateNextAction: '2026-05-10T09:00:00', _completed: false }),
      // tomorrow
      makeReq({ id: 4, DateNextAction: '2026-05-11T09:00:00', _completed: false }),
      // closed today: _completed=true, Updated=today
      makeReq({ id: 5, DateNextAction: null, Updated: '2026-05-10T10:00:00', _completed: true }),
      // closed old: not today
      makeReq({ id: 6, DateNextAction: null, Updated: '2026-05-08T10:00:00', _completed: true }),
    ]
    ;(listRequests as any).mockResolvedValue(mockData)

    const wrapper = mount(TodayTodoView, {
      global: { stubs: { teleport: true } },
    })

    await flushPromises()

    // Should show 4 stat cards with correct counts
    const statCards = wrapper.findAll('.stat-card')
    expect(statCards).toHaveLength(4)

    // Overdue: 2, Today: 1, Tomorrow: 1, Closed today: 1
    expect(statCards[0]!.find('.stat-count').text()).toBe('2')
    expect(statCards[1]!.find('.stat-count').text()).toBe('1')
    expect(statCards[2]!.find('.stat-count').text()).toBe('1')
    expect(statCards[3]!.find('.stat-count').text()).toBe('1')
  })

  it('overdue section shows red badge text', async () => {
    const mockData = [
      makeReq({ id: 1, DateNextAction: '2026-05-09T09:00:00', _completed: false }),
    ]
    ;(listRequests as any).mockResolvedValue(mockData)

    const wrapper = mount(TodayTodoView, {
      global: { stubs: { teleport: true } },
    })

    await flushPromises()

    // Overdue section should be rendered (auto-expanded)
    const overdueSection = wrapper.find('.section-header--overdue')
    expect(overdueSection.exists()).toBe(true)

    // The badge in the section header should have --overdue class
    expect(overdueSection.find('.section-badge--overdue').exists()).toBe(true)
  })

  it('"僅我的" toggle filters by current user SalesRep_ID', async () => {
    const mockData = [
      // owned by current user (id: 1001)
      makeReq({ id: 1, DateNextAction: '2026-05-10T09:00:00', SalesRep_ID: { id: 1001, Name: 'TestUser' } }),
      // owned by another user
      makeReq({ id: 2, DateNextAction: '2026-05-10T09:00:00', SalesRep_ID: { id: 9999, Name: 'OtherUser' } }),
    ]
    ;(listRequests as any).mockResolvedValue(mockData)

    const wrapper = mount(TodayTodoView, {
      global: { stubs: { teleport: true } },
    })

    await flushPromises()

    // Initially "全部" — today count should be 2
    const statCards = wrapper.findAll('.stat-card')
    expect(statCards[1]!.find('.stat-count').text()).toBe('2')

    // Click "僅我的"
    const myBtn = wrapper.findAll('.toggle-btn')[1]!
    await myBtn.trigger('click')

    // Now today count should be 1 (only currentUser's)
    const statCardsAfter = wrapper.findAll('.stat-card')
    expect(statCardsAfter[1]!.find('.stat-count').text()).toBe('1')
  })

  it('clicking a request card navigates to consultation-edit', async () => {
    const reqId = 42
    const mockData = [
      makeReq({ id: reqId, DateNextAction: '2026-05-10T09:00:00', _completed: false }),
    ]
    ;(listRequests as any).mockResolvedValue(mockData)

    const wrapper = mount(TodayTodoView, {
      global: { stubs: { teleport: true } },
    })

    await flushPromises()

    // Find and click the request card
    const card = wrapper.find('.request-card')
    expect(card.exists()).toBe(true)
    await card.trigger('click')

    expect(mockPush).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'consultation-edit',
        params: expect.objectContaining({ id: reqId }),
      })
    )
  })

  it('shows empty state when no matching requests', async () => {
    ;(listRequests as any).mockResolvedValue([])

    const wrapper = mount(TodayTodoView, {
      global: { stubs: { teleport: true } },
    })

    await flushPromises()

    expect(wrapper.find('.empty-state').exists()).toBe(true)
    expect(wrapper.find('.empty-state').text()).toContain('今日沒有待辦事項')
  })

  it('sections are collapsed when they have no items', async () => {
    // Only one today item — other sections should be absent from DOM
    const mockData = [
      makeReq({ id: 1, DateNextAction: '2026-05-10T09:00:00', _completed: false }),
    ]
    ;(listRequests as any).mockResolvedValue(mockData)

    const wrapper = mount(TodayTodoView, {
      global: { stubs: { teleport: true } },
    })

    await flushPromises()

    // Overdue section should not exist (0 items)
    expect(wrapper.find('.section-header--overdue').exists()).toBe(false)
    // Tomorrow section should not exist (0 items)
    expect(wrapper.find('.section-header--tomorrow').exists()).toBe(false)
    // Today section exists
    expect(wrapper.find('.section-header--today').exists()).toBe(true)
  })

  it('sorts requests by Priority ascending within a bucket', async () => {
    const mockData = [
      makeReq({ id: 1, DateNextAction: '2026-05-10T09:00:00', Priority: 9, Summary: 'Low priority' }),
      makeReq({ id: 2, DateNextAction: '2026-05-10T09:00:00', Priority: 1, Summary: 'High priority' }),
      makeReq({ id: 3, DateNextAction: '2026-05-10T09:00:00', Priority: 5, Summary: 'Medium priority' }),
    ]
    ;(listRequests as any).mockResolvedValue(mockData)

    const wrapper = mount(TodayTodoView, {
      global: { stubs: { teleport: true } },
    })

    await flushPromises()

    const cards = wrapper.findAll('.request-card')
    expect(cards).toHaveLength(3)
    // First card = highest priority (1)
    expect(cards[0]!.find('.card-summary').text()).toBe('High priority')
    // Last card = lowest priority (9)
    expect(cards[2]!.find('.card-summary').text()).toBe('Low priority')
  })
})
