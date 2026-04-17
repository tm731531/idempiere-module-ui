import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import CustomerJourneyView from '../CustomerJourneyView.vue'

// ---------------------------------------------------------------------------
// vi.mock factories — hoisted, no outer-scope variable references
// ---------------------------------------------------------------------------

vi.mock('vue-router', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
}))

// Default: 4 statuses → 4 stages, one per stage
const MOCK_STATUSES_4 = [
  { R_Status_ID: 10, Name: '新建', SeqNo: 10, IsClosed: false },
  { R_Status_ID: 20, Name: '跟進中', SeqNo: 20, IsClosed: false },
  { R_Status_ID: 30, Name: '報價中', SeqNo: 30, IsClosed: false },
  { R_Status_ID: 40, Name: '已成交', SeqNo: 40, IsClosed: true },
]

// Mock requests: 4 in stage0, 3 in stage1, 2 in stage2, 1 in stage3
const MOCK_REQUESTS = [
  // Stage 0 (status 10) — 4 records
  { id: 1, Summary: 'Req 1', R_Status_ID: { id: 10, identifier: '新建' }, C_BPartner_ID: { id: 100, Name: '客戶甲' }, Created: '2025-01-01T00:00:00Z' },
  { id: 2, Summary: 'Req 2', R_Status_ID: { id: 10, identifier: '新建' }, C_BPartner_ID: null, Created: '2025-01-02T00:00:00Z' },
  { id: 3, Summary: 'Req 3', R_Status_ID: { id: 10, identifier: '新建' }, C_BPartner_ID: null, Created: '2025-01-03T00:00:00Z' },
  { id: 4, Summary: 'Req 4', R_Status_ID: { id: 10, identifier: '新建' }, C_BPartner_ID: null, Created: '2025-01-04T00:00:00Z' },
  // Stage 1 (status 20) — 3 records
  { id: 5, Summary: 'Req 5', R_Status_ID: { id: 20, identifier: '跟進中' }, C_BPartner_ID: { id: 101, Name: '客戶乙' }, Created: '2025-01-05T00:00:00Z' },
  { id: 6, Summary: 'Req 6', R_Status_ID: { id: 20, identifier: '跟進中' }, C_BPartner_ID: null, Created: '2025-01-06T00:00:00Z' },
  { id: 7, Summary: 'Req 7', R_Status_ID: { id: 20, identifier: '跟進中' }, C_BPartner_ID: null, Created: '2025-01-07T00:00:00Z' },
  // Stage 2 (status 30) — 2 records
  { id: 8, Summary: 'Req 8', R_Status_ID: { id: 30, identifier: '報價中' }, C_BPartner_ID: null, Created: '2025-01-08T00:00:00Z' },
  { id: 9, Summary: 'Req 9', R_Status_ID: { id: 30, identifier: '報價中' }, C_BPartner_ID: null, Created: '2025-01-09T00:00:00Z' },
  // Stage 3 (status 40) — 1 record
  { id: 10, Summary: 'Req 10', R_Status_ID: { id: 40, identifier: '已成交' }, C_BPartner_ID: { id: 102, Name: '客戶丙' }, Created: '2025-01-10T00:00:00Z' },
]

vi.mock('@/api/request', () => ({
  listRequests: vi.fn(() => Promise.resolve(MOCK_REQUESTS)),
  listRequestStatuses: vi.fn(() => Promise.resolve(MOCK_STATUSES_4)),
}))

// useRequestStatuses: provide a module-level statuses singleton that mirrors MOCK_STATUSES_4
vi.mock('@/composables/useRequestStatuses', () => {
  const statuses = [
    { R_Status_ID: 10, Name: '新建', SeqNo: 10, IsClosed: false },
    { R_Status_ID: 20, Name: '跟進中', SeqNo: 20, IsClosed: false },
    { R_Status_ID: 30, Name: '報價中', SeqNo: 30, IsClosed: false },
    { R_Status_ID: 40, Name: '已成交', SeqNo: 40, IsClosed: true },
  ]
  return {
    loadRequestStatuses: vi.fn(() => Promise.resolve(statuses)),
    getAllStatuses: vi.fn(() => statuses),
    extractStatusId: vi.fn((req: any) => {
      const raw = req?.R_Status_ID
      if (raw == null) return null
      if (typeof raw === 'number') return raw
      if (typeof raw === 'object' && 'id' in raw) return raw.id ?? null
      return null
    }),
    getStatusName: vi.fn((id: number) => {
      const s = statuses.find(x => x.R_Status_ID === id)
      return s?.Name ?? ''
    }),
    isRequestCompleted: vi.fn((req: any) => {
      const raw = req?.R_Status_ID
      if (!raw) return false
      const id = typeof raw === 'object' ? raw.id : raw
      const s = statuses.find(x => x.R_Status_ID === id)
      return s?.IsClosed === true
    }),
  }
})

// ---------------------------------------------------------------------------
// Import mocked modules for spying
// ---------------------------------------------------------------------------
import * as requestApi from '@/api/request'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function mountView() {
  return mount(CustomerJourneyView, { global: { stubs: {} } })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('CustomerJourneyView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Re-attach mock implementations that clearAllMocks wipes
    vi.mocked(requestApi.listRequests).mockResolvedValue(MOCK_REQUESTS)
    vi.mocked(requestApi.listRequestStatuses).mockResolvedValue(MOCK_STATUSES_4)
  })

  // -------------------------------------------------------------------------
  // 1. Renders 4 stages with correct counts
  // -------------------------------------------------------------------------
  it('renders 4 stages after loading', async () => {
    const wrapper = mountView()
    await flushPromises()

    const bars = wrapper.findAll('.funnel-bar')
    expect(bars.length).toBe(4)
  })

  it('displays Chinese stage names', async () => {
    const wrapper = mountView()
    await flushPromises()

    const text = wrapper.text()
    expect(text).toContain('潛在客戶')
    expect(text).toContain('有意向')
    expect(text).toContain('商機')
    expect(text).toContain('成交客戶')
  })

  it('shows correct request counts per stage', async () => {
    const wrapper = mountView()
    await flushPromises()

    // Stage 0 → 4, Stage 1 → 3, Stage 2 → 2, Stage 3 → 1
    const bars = wrapper.findAll('.funnel-bar')
    expect(bars[0]!.text()).toContain('4 件')
    expect(bars[1]!.text()).toContain('3 件')
    expect(bars[2]!.text()).toContain('2 件')
    expect(bars[3]!.text()).toContain('1 件')
  })

  // -------------------------------------------------------------------------
  // 2. Quartile assignment — 4 statuses → 1 per stage
  // -------------------------------------------------------------------------
  it('assigns statuses one-per-stage for exactly 4 statuses', async () => {
    const wrapper = mountView()
    await flushPromises()

    // Legend: each stage must list exactly one status name
    const legendItems = wrapper.findAll('.legend-item')
    expect(legendItems.length).toBe(4)

    const allLegendText = wrapper.findAll('.legend-status-tag').map(el => el.text())
    expect(allLegendText).toContain('新建')
    expect(allLegendText).toContain('跟進中')
    expect(allLegendText).toContain('報價中')
    expect(allLegendText).toContain('已成交')
  })

  // -------------------------------------------------------------------------
  // 3. Quartile assignment logic — unit tests on the pure function
  // -------------------------------------------------------------------------
  it('correctly distributes 8 statuses into 4 groups of 2', () => {
    // Mirror the buildStageGroups logic inline to test without component mounting
    function buildStageGroups(allStatuses: any[]): any[][] {
      const n = allStatuses.length
      if (n === 0) return []
      const numStages = Math.min(4, n)
      const groups: any[][] = Array.from({ length: numStages }, () => [])
      allStatuses.forEach((s, i) => {
        const groupIdx = Math.min(Math.floor((i * numStages) / n), numStages - 1)
        const g = groups[groupIdx]; if (g) g.push(s)
      })
      return groups
    }

    const statuses8 = Array.from({ length: 8 }, (_, i) => ({
      R_Status_ID: i + 1,
      Name: `狀態 ${i + 1}`,
      SeqNo: (i + 1) * 10,
      IsClosed: i >= 6,
    }))

    const groups = buildStageGroups(statuses8)
    expect(groups.length).toBe(4)
    groups.forEach((group: any[]) => expect(group.length).toBe(2))
  })

  it('collapses to 3 groups when only 3 statuses given', () => {
    function buildStageGroups(allStatuses: any[]): any[][] {
      const n = allStatuses.length
      if (n === 0) return []
      const numStages = Math.min(4, n)
      const groups: any[][] = Array.from({ length: numStages }, () => [])
      allStatuses.forEach((s, i) => {
        const groupIdx = Math.min(Math.floor((i * numStages) / n), numStages - 1)
        const g = groups[groupIdx]; if (g) g.push(s)
      })
      return groups
    }

    const statuses3 = [
      { R_Status_ID: 1, Name: 'A', SeqNo: 10 },
      { R_Status_ID: 2, Name: 'B', SeqNo: 20 },
      { R_Status_ID: 3, Name: 'C', SeqNo: 30 },
    ]
    const groups = buildStageGroups(statuses3)
    expect(groups.length).toBe(3)
  })

  it('returns empty array when no statuses', () => {
    function buildStageGroups(allStatuses: any[]): any[][] {
      const n = allStatuses.length
      if (n === 0) return []
      const numStages = Math.min(4, n)
      const groups: any[][] = Array.from({ length: numStages }, () => [])
      allStatuses.forEach((s, i) => {
        const groupIdx = Math.min(Math.floor((i * numStages) / n), numStages - 1)
        const g = groups[groupIdx]; if (g) g.push(s)
      })
      return groups
    }
    expect(buildStageGroups([])).toEqual([])
  })

  // -------------------------------------------------------------------------
  // 4. Component renders empty state (mocked with 4 statuses but 0 stages = empty)
  // -------------------------------------------------------------------------
  it('renders empty state when no statuses', async () => {
    const { getAllStatuses } = await import('@/composables/useRequestStatuses')
    vi.mocked(getAllStatuses).mockReturnValue([])

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.find('.empty-state').exists()).toBe(true)
    expect(wrapper.find('.funnel-bars').exists()).toBe(false)

    // Restore
    vi.mocked(getAllStatuses).mockReturnValue(MOCK_STATUSES_4 as any)
  })

  // -------------------------------------------------------------------------
  // 5. Conversion rate calculation
  // -------------------------------------------------------------------------
  it('shows conversion rates from Stage 1 onwards', async () => {
    const wrapper = mountView()
    await flushPromises()

    const text = wrapper.text()

    // Stage 1 conversion: 3/4 = 75.0%
    expect(text).toContain('75.0%')

    // Stage 2 conversion: 2/3 = 66.7%
    expect(text).toContain('66.7%')

    // Stage 3 conversion: 1/2 = 50.0%
    expect(text).toContain('50.0%')
  })

  it('shows drop-off counts', async () => {
    const wrapper = mountView()
    await flushPromises()

    const text = wrapper.text()
    // Stage 1 drop-off: 4 - 3 = 1
    expect(text).toContain('-1 流失')
    // Stage 2 drop-off: 3 - 2 = 1
    // Stage 3 drop-off: 2 - 1 = 1
  })

  // -------------------------------------------------------------------------
  // 6. Drill-down expands cards
  // -------------------------------------------------------------------------
  it('drill-down panel hidden by default', async () => {
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.find('.drill-down').exists()).toBe(false)
  })

  it('clicking a bar expands drill-down panel', async () => {
    const wrapper = mountView()
    await flushPromises()

    const firstBar = wrapper.find('.funnel-bar')
    await firstBar.trigger('click')
    await wrapper.vm.$nextTick()

    const panel = wrapper.find('.drill-down')
    expect(panel.exists()).toBe(true)
  })

  it('drill-down shows requests for the clicked stage', async () => {
    const wrapper = mountView()
    await flushPromises()

    const firstBar = wrapper.find('.funnel-bar')
    await firstBar.trigger('click')
    await wrapper.vm.$nextTick()

    const panel = wrapper.find('.drill-down')
    const cards = panel.findAll('.drill-card')
    // Stage 0 has 4 requests
    expect(cards.length).toBe(4)
    const allText = panel.text()
    expect(allText).toContain('Req 1')
    expect(allText).toContain('Req 2')
  })

  it('clicking the same bar again collapses the drill-down', async () => {
    const wrapper = mountView()
    await flushPromises()

    const firstBar = wrapper.find('.funnel-bar')
    await firstBar.trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.drill-down').exists()).toBe(true)

    await firstBar.trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.drill-down').exists()).toBe(false)
  })

  it('clicking a drill-down card navigates to consultation edit', async () => {
    const { useRouter } = await import('vue-router')
    const mockPush = vi.fn()
    vi.mocked(useRouter).mockReturnValue({ push: mockPush } as any)

    const wrapper = mountView()
    await flushPromises()

    const firstBar = wrapper.find('.funnel-bar')
    await firstBar.trigger('click')
    await wrapper.vm.$nextTick()

    const firstCard = wrapper.find('.drill-card')
    await firstCard.trigger('click')

    expect(mockPush).toHaveBeenCalledWith({
      name: 'consultation-edit',
      params: { id: 1 },
    })
  })

  // -------------------------------------------------------------------------
  // 7. Date range filter
  // -------------------------------------------------------------------------
  it('renders date range buttons', async () => {
    const wrapper = mountView()
    await flushPromises()

    const btns = wrapper.findAll('.date-btn')
    const labels = btns.map(b => b.text())
    expect(labels).toContain('7 天')
    expect(labels).toContain('30 天')
    expect(labels).toContain('90 天')
    expect(labels).toContain('全部')
  })

  it('applies date range filter — 7 days shows only recent records', async () => {
    // Create requests: one recent (within 7 days), one old
    const now = new Date()
    const recent = new Date(now.getTime() - 2 * 86400_000).toISOString()   // 2 days ago
    const old = new Date(now.getTime() - 30 * 86400_000).toISOString()     // 30 days ago

    const filteredRequests = [
      { id: 99, Summary: 'Recent', R_Status_ID: { id: 10, identifier: '新建' }, C_BPartner_ID: null, Created: recent },
      { id: 98, Summary: 'Old', R_Status_ID: { id: 10, identifier: '新建' }, C_BPartner_ID: null, Created: old },
    ]
    vi.mocked(requestApi.listRequests).mockResolvedValue(filteredRequests)

    const wrapper = mountView()
    await flushPromises()

    // Switch to 7-day filter
    const sevenBtn = wrapper.findAll('.date-btn').find(b => b.text() === '7 天')
    expect(sevenBtn).toBeTruthy()
    await sevenBtn!.trigger('click')
    await wrapper.vm.$nextTick()

    // Only recent request is visible; we check total count shown in bars
    const barText = wrapper.findAll('.bar-count').map(el => el.text())
    const total = barText.reduce((sum, t) => sum + parseInt(t) || 0, 0)
    expect(total).toBe(1)
  })
})
