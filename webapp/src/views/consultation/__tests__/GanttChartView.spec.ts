import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import GanttChartView from '../GanttChartView.vue'

// ─── Mocks ────────────────────────────────────────────────────────────────

vi.mock('vue-router', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
}))

// Fixed "today" so date-dependent colour tests are deterministic
// Set before module-level vi.mock factories run
const FAKE_TODAY = new Date('2026-04-17T00:00:00')

vi.mock('@/api/request', () => ({
  listRequests: vi.fn(() => Promise.resolve([
    {
      id: 1001,
      DocumentNo: 'REQ-001',
      Summary: '第一個諮詢',
      // Created = start of bar (within 2-week window starting 3 days before today = 2026-04-14)
      Created: '2026-04-15T09:00:00Z',
      // DateNextAction after today → green bar
      DateNextAction: '2026-04-20T00:00:00Z',
      R_Status_ID: { id: 1, identifier: '進行中', IsClosed: false },
      C_BPartner_ID: { id: 200, Name: '測試客戶' },
      SalesRep_ID: { id: 100, Name: '王小明' },
    },
    {
      id: 1002,
      DocumentNo: 'REQ-002',
      Summary: '已關閉諮詢',
      Created: '2026-04-15T09:00:00Z',
      DateNextAction: '2026-04-20T00:00:00Z',
      R_Status_ID: { id: 2, identifier: '已完成', IsClosed: true },
      C_BPartner_ID: { id: 201, Name: '客戶B' },
      SalesRep_ID: null,
    },
    {
      id: 1003,
      DocumentNo: 'REQ-003',
      Summary: '逾期諮詢',
      // Created well before viewStart still generates a visible bar because endDate is within view
      Created: '2026-04-12T09:00:00Z',
      // DateNextAction before today → overdue → red
      DateNextAction: '2026-04-16T00:00:00Z',
      R_Status_ID: { id: 1, identifier: '進行中', IsClosed: false },
      C_BPartner_ID: null,
      SalesRep_ID: null,
    },
  ])),
  updateRequest: vi.fn(() => Promise.resolve({ id: 1001 })),
}))

// ─── Helpers ──────────────────────────────────────────────────────────────

function mountGantt() {
  return mount(GanttChartView, { global: { stubs: {} } })
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('GanttChartView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Use fake timers so "today" is deterministic
    vi.useFakeTimers()
    vi.setSystemTime(FAKE_TODAY)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders rows after data loads', async () => {
    const wrapper = mountGantt()
    await flushPromises()
    // After loading rows should be rendered
    expect(wrapper.find('.gantt-container').exists()).toBe(true)
    const rows = wrapper.findAll('.gantt-row')
    expect(rows.length).toBe(3)
  })

  it('renders toolbar with zoom buttons', async () => {
    const wrapper = mountGantt()
    await flushPromises()
    const zoomBtns = wrapper.findAll('.zoom-btn')
    expect(zoomBtns.length).toBe(3)
    const labels = zoomBtns.map(b => b.text())
    expect(labels).toContain('2週')
    expect(labels).toContain('1月')
    expect(labels).toContain('季度')
  })

  it('today-line element exists with a positive left offset', async () => {
    const wrapper = mountGantt()
    await flushPromises()
    const todayLine = wrapper.find('.gantt-today-line')
    expect(todayLine.exists()).toBe(true)
    // viewStart = today - 3 days → today is 3 days into the viewport → left > 0
    const leftPx = parseFloat((todayLine.element as HTMLElement).style.left)
    expect(leftPx).toBeGreaterThan(0)
  })

  it('today-line position changes when zoom changes', async () => {
    const wrapper = mountGantt()
    await flushPromises()

    const todayLineBefore = parseFloat((wrapper.find('.gantt-today-line').element as HTMLElement).style.left)

    // Switch to 1-month zoom (2-day columns)
    const zoomBtns = wrapper.findAll('.zoom-btn')
    const monthBtn = zoomBtns.find(b => b.text() === '1月')
    expect(monthBtn).toBeDefined()
    await monthBtn!.trigger('click')
    await wrapper.vm.$nextTick()

    const todayLineAfter = parseFloat((wrapper.find('.gantt-today-line').element as HTMLElement).style.left)
    // Different zoom → different px per day → different today-line position
    expect(todayLineAfter).not.toEqual(todayLineBefore)
  })

  it('colors closed request bar as gray', async () => {
    const wrapper = mountGantt()
    await flushPromises()
    // REQ-002 has IsClosed=true
    const grayBars = wrapper.findAll('.gantt-bar--gray')
    expect(grayBars.length).toBeGreaterThan(0)
  })

  it('colors overdue request bar as red', async () => {
    const wrapper = mountGantt()
    await flushPromises()
    // REQ-003 DateNextAction = 2026-04-16, today = 2026-04-17 → overdue → red
    const redBars = wrapper.findAll('.gantt-bar--red')
    expect(redBars.length).toBeGreaterThan(0)
  })

  it('renders date column headers', async () => {
    const wrapper = mountGantt()
    await flushPromises()
    const dateCells = wrapper.findAll('.date-cell')
    expect(dateCells.length).toBeGreaterThan(0)
  })

  it('shows empty state when no requests are returned', async () => {
    const { listRequests } = await import('@/api/request')
    vi.mocked(listRequests).mockResolvedValueOnce([])

    const wrapper = mountGantt()
    await flushPromises()
    expect(wrapper.find('.empty-state').exists()).toBe(true)
  })

  it('navigates back on back button click', async () => {
    const pushMock = vi.fn()
    const { useRouter } = await import('vue-router')
    vi.mocked(useRouter).mockReturnValue({ push: pushMock } as any)

    const wrapper = mountGantt()
    await flushPromises()
    await wrapper.find('.back-btn').trigger('click')
    expect(pushMock).toHaveBeenCalledWith({ name: 'consultation-list' })
  })
})
