import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import AppointmentForm from '../AppointmentForm.vue'

// Mock API modules
vi.mock('@/api/assignment', () => ({
  createAssignment: vi.fn(),
  createMultipleAssignments: vi.fn(),
  updateAssignment: vi.fn(),
  deleteAssignment: vi.fn(),
  cancelAssignment: vi.fn(),
  checkConflict: vi.fn(),
}))
vi.mock('@/api/resource', () => ({
  createResource: vi.fn(),
}))
vi.mock('@/api/lookup', () => ({
  lookupOrgWarehouse: vi.fn(),
}))
vi.mock('@/api/bpartner', () => ({
  searchCustomers: vi.fn().mockResolvedValue([]),
  getCustomerDetail: vi.fn().mockResolvedValue(null),
}))

// useAppointmentStatuses composable — stub to avoid API calls in tests
vi.mock('@/composables/useAppointmentStatuses', () => ({
  useAppointmentStatuses: () => ({
    statuses: { value: [
      { Value: 'SCH', Name: '預約中', color: '#FBBF24' },
      { Value: 'CFM', Name: '已確認', color: '#3B82F6' },
    ] },
    load: vi.fn().mockResolvedValue(undefined),
    getStatusColor: vi.fn().mockReturnValue('#FBBF24'),
    getStatusName: vi.fn().mockReturnValue('預約中'),
    isTerminalStatus: vi.fn().mockReturnValue(false),
    clearCache: vi.fn(),
  }),
  isTerminalStatus: vi.fn().mockReturnValue(false),
  loadAppointmentStatuses: vi.fn().mockResolvedValue([]),
  getStatusColor: vi.fn().mockReturnValue('#FBBF24'),
  clearAppointmentStatusCache: vi.fn(),
}))

// useAppointmentDesc composable — stub
vi.mock('@/composables/useAppointmentDesc', () => ({
  parseDesc: vi.fn().mockReturnValue({}),
  serializeDesc: vi.fn().mockReturnValue('{}'),
  buildName: vi.fn().mockReturnValue(''),
}))
vi.mock('@/api/utils', () => ({
  parseIdempiereDateTime: (s: string) => new Date(s),
  toIdempiereDateTime: (d: Date) => d.toISOString(),
}))
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    context: { organizationId: 1 },
  }),
}))

// SearchSelector is heavy — stub it out
vi.mock('@/components/SearchSelector.vue', () => ({
  default: {
    name: 'SearchSelector',
    props: ['modelValue', 'tableName', 'displayField', 'searchField', 'filter', 'initialLabel'],
    emits: ['update:modelValue'],
    template: '<input class="search-selector-stub" />',
  },
}))

// ColorPickerPopover (parallel agent's component) — stub to avoid compile error
vi.mock('@/components/ColorPickerPopover.vue', () => ({
  default: {
    name: 'ColorPickerPopover',
    props: ['visible', 'modelValue', 'anchorEl'],
    emits: ['update:visible', 'change'],
    template: '<div />',
  },
}))

// useAssignmentColors composable (parallel agent's composable) — stub
vi.mock('@/composables/useAssignmentColors', () => ({
  useAssignmentColors: () => ({
    setAssignmentColorOverride: vi.fn(),
    assignmentColors: { value: {} },
  }),
  flushPendingSave: vi.fn(),
}))

import {
  createAssignment,
  createMultipleAssignments,
  checkConflict,
} from '@/api/assignment'

const mockRouter = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', component: { template: '<div/>' } },
    { path: '/consultation/:id', name: 'consultation-edit', component: { template: '<div/>' } },
    { path: '/appointment', name: 'appointment-calendar', component: { template: '<div/>' } },
  ],
})

const mockResources = [
  { id: 101, Name: '張醫師' },
  { id: 102, Name: '李護士' },
  { id: 103, Name: '診療室A' },
]

function mountForm(propsOverrides = {}) {
  return mount(AppointmentForm, {
    props: {
      resources: mockResources,
      existingAssignments: [],
      ...propsOverrides,
    },
    global: {
      plugins: [mockRouter],
    },
  })
}

describe('AppointmentForm — single resource mode (default)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders single-resource selector by default', () => {
    const wrapper = mountForm()
    // Single-resource mode: resource <select> is inside .selector-row
    expect(wrapper.find('.selector-row select').exists()).toBe(true)
    expect(wrapper.find('.resource-checklist').exists()).toBe(false)
  })

  it('shows mode toggle only in create mode', () => {
    const wrapper = mountForm()
    expect(wrapper.find('.mode-toggle').exists()).toBe(true)
  })

  it('does NOT show mode toggle when editing', () => {
    const wrapper = mountForm({ editingAppt: { id: 1, S_Resource_ID: 101, Name: 'Test', AssignDateFrom: '2026-01-01T10:00:00Z', AssignDateTo: '2026-01-01T11:00:00Z' } })
    expect(wrapper.find('.mode-toggle').exists()).toBe(false)
  })
})

describe('AppointmentForm — multi-resource mode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(checkConflict).mockResolvedValue(false)
  })

  async function switchToMultiMode(wrapper: ReturnType<typeof mountForm>) {
    const buttons = wrapper.findAll('.mode-btn')
    await buttons[1]!.trigger('click') // '多資源同時' button
    await flushPromises()
  }

  it('switches to checklist when multi-mode is selected', async () => {
    const wrapper = mountForm()
    await switchToMultiMode(wrapper)

    expect(wrapper.find('.resource-checklist').exists()).toBe(true)
    // The single-resource <select> (resource selector) should be gone in multi-mode.
    // Note: the status <select> is still present; use .selector-row select to target
    // the resource selector specifically.
    expect(wrapper.find('.selector-row select').exists()).toBe(false)
  })

  it('renders one checkbox per resource', async () => {
    const wrapper = mountForm()
    await switchToMultiMode(wrapper)

    const checkboxes = wrapper.findAll('input[type="checkbox"]')
    expect(checkboxes).toHaveLength(mockResources.length)
  })

  it('submitting with 3 checked resources calls createMultipleAssignments with all 3 IDs', async () => {
    vi.mocked(createMultipleAssignments).mockResolvedValue([
      { resourceId: 101, result: { id: 1 } },
      { resourceId: 102, result: { id: 2 } },
      { resourceId: 103, result: { id: 3 } },
    ])

    const wrapper = mountForm()
    await switchToMultiMode(wrapper)

    // Check all 3 checkboxes
    const checkboxes = wrapper.findAll('input[type="checkbox"]')
    for (const cb of checkboxes) {
      await cb.setValue(true)
    }

    // Fill mandatory fields
    await wrapper.find('input[type="datetime-local"]').setValue('2026-06-01T10:00')
    const timeInputs = wrapper.findAll('input[type="datetime-local"]')
    await timeInputs[1]!.setValue('2026-06-01T11:00')
    await wrapper.find('input[type="text"]').setValue('聯合療程')

    await wrapper.find('.btn-primary').trigger('click')
    await flushPromises()

    expect(createMultipleAssignments).toHaveBeenCalledTimes(1)
    const firstCall = vi.mocked(createMultipleAssignments).mock.calls[0]!
    const [payload, resourceIds] = firstCall
    expect(resourceIds).toEqual([101, 102, 103])
    expect(payload).toMatchObject({ Name: '聯合療程', AD_Org_ID: 1 })
  })

  it('shows success summary after all 3 succeed', async () => {
    vi.mocked(createMultipleAssignments).mockResolvedValue([
      { resourceId: 101, result: { id: 1 } },
      { resourceId: 102, result: { id: 2 } },
      { resourceId: 103, result: { id: 3 } },
    ])

    const saved = vi.fn()
    const wrapper = mountForm()
    wrapper.vm.$emit = saved
    await switchToMultiMode(wrapper)

    // Fill the form
    const checkboxes = wrapper.findAll('input[type="checkbox"]')
    for (const cb of checkboxes) {
      await cb.setValue(true)
    }
    const timeInputs = wrapper.findAll('input[type="datetime-local"]')
    await timeInputs[0]!.setValue('2026-06-01T10:00')
    await timeInputs[1]!.setValue('2026-06-01T11:00')
    await wrapper.find('input[type="text"]').setValue('聯合療程')

    await wrapper.find('.btn-primary').trigger('click')
    await flushPromises()

    // When all succeed the 'saved' event is emitted and the summary isn't shown (modal closes)
    // but we can still check createMultipleAssignments was called
    expect(createMultipleAssignments).toHaveBeenCalled()
  })

  it('shows partial-failure summary when some resources fail', async () => {
    vi.mocked(createMultipleAssignments).mockResolvedValue([
      { resourceId: 101, result: { id: 1 } },
      { resourceId: 102, result: { id: 2 } },
      { resourceId: 103, error: new Error('conflict') },
    ])

    const wrapper = mountForm()
    await switchToMultiMode(wrapper)

    const checkboxes = wrapper.findAll('input[type="checkbox"]')
    for (const cb of checkboxes) {
      await cb.setValue(true)
    }
    const timeInputs = wrapper.findAll('input[type="datetime-local"]')
    await timeInputs[0]!.setValue('2026-06-01T10:00')
    await timeInputs[1]!.setValue('2026-06-01T11:00')
    await wrapper.find('input[type="text"]').setValue('聯合療程')

    await wrapper.find('.btn-primary').trigger('click')
    await flushPromises()

    const summary = wrapper.find('.summary-partial')
    expect(summary.exists()).toBe(true)
    expect(summary.text()).toContain('2 成功')
    expect(summary.text()).toContain('1 失敗')
  })

  it('shows conflict dot for resources that have conflicts', async () => {
    // 101 has conflict, 102/103 do not
    vi.mocked(checkConflict).mockImplementation(async (resourceId) => {
      return resourceId === 101
    })

    // The watcher is debounced (300 ms) — use fake timers to advance past it
    vi.useFakeTimers()
    try {
      const wrapper = mountForm()
      await switchToMultiMode(wrapper)

      // Select all resources to trigger conflict check
      const checkboxes = wrapper.findAll('input[type="checkbox"]')
      for (const cb of checkboxes) {
        await cb.setValue(true)
      }

      // Set valid time range so the watcher fires
      const timeInputs = wrapper.findAll('input[type="datetime-local"]')
      await timeInputs[0]!.setValue('2026-06-01T10:00')
      await timeInputs[1]!.setValue('2026-06-01T11:00')

      // Advance past the 300 ms debounce then flush async operations
      await vi.advanceTimersByTimeAsync(300)
      await flushPromises()

      const conflictDots = wrapper.findAll('.conflict-dot')
      expect(conflictDots).toHaveLength(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('disables save button when no resources are checked in multi-mode', async () => {
    const wrapper = mountForm()
    await switchToMultiMode(wrapper)

    const saveBtn = wrapper.find('.btn-primary')
    expect(saveBtn.attributes('disabled')).toBeDefined()
  })

  it('enables save button when at least one resource is checked', async () => {
    const wrapper = mountForm()
    await switchToMultiMode(wrapper)

    const checkboxes = wrapper.findAll('input[type="checkbox"]')
    await checkboxes[0]!.setValue(true)

    const saveBtn = wrapper.find('.btn-primary')
    expect(saveBtn.attributes('disabled')).toBeUndefined()
  })
})

describe('AppointmentForm — createMultipleAssignments helper', () => {
  it('createAssignment is called once in single mode', async () => {
    vi.mocked(createAssignment).mockResolvedValue({ id: 99 })

    const wrapper = mountForm()
    // Stay in single mode, select resource via the resource selector (inside .selector-row)
    const select = wrapper.find('.selector-row select')
    await select.setValue('101')

    const timeInputs = wrapper.findAll('input[type="datetime-local"]')
    await timeInputs[0]!.setValue('2026-06-01T10:00')
    await timeInputs[1]!.setValue('2026-06-01T11:00')
    await wrapper.find('input[type="text"]').setValue('單一預約')

    await wrapper.find('.btn-primary').trigger('click')
    await flushPromises()

    expect(createAssignment).toHaveBeenCalledTimes(1)
    expect(createMultipleAssignments).not.toHaveBeenCalled()
  })
})

describe('AppointmentForm — query-param prefill', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    // Reset router to root so query params from previous tests don't bleed over
    await mockRouter.push('/')
  })

  async function mountFormWithQuery(query: Record<string, string>) {
    await mockRouter.push({ path: '/', query })
    await flushPromises()
    return mount(AppointmentForm, {
      props: {
        resources: mockResources,
        existingAssignments: [],
      },
      global: {
        plugins: [mockRouter],
      },
    })
  }

  it('pre-fills C_BPartner_ID when customerId query param is present', async () => {
    const wrapper = await mountFormWithQuery({ customerId: '1234' })
    await flushPromises()

    const vm = wrapper.vm as any
    expect(vm.form.bpartnerId).toBe(1234)
  })

  it('ignores invalid (non-numeric) customerId query param', async () => {
    const wrapper = await mountFormWithQuery({ customerId: 'abc' })
    await flushPromises()

    const vm = wrapper.vm as any
    expect(vm.form.bpartnerId).toBeNull()
  })

  it('shows consultation link banner when consultationId query param is present', async () => {
    const wrapper = await mountFormWithQuery({ consultationId: '42' })
    await flushPromises()

    const banner = wrapper.find('.consultation-banner')
    expect(banner.exists()).toBe(true)
    expect(banner.text()).toContain('關聯諮詢 #42')
  })

  it('does NOT show consultation banner when no consultationId param', async () => {
    const wrapper = await mountFormWithQuery({})
    await flushPromises()

    expect(wrapper.find('.consultation-banner').exists()).toBe(false)
  })

  it('shows clean create-mode form when no query params are present', async () => {
    const wrapper = await mountFormWithQuery({})
    await flushPromises()

    const vm = wrapper.vm as any
    expect(vm.form.bpartnerId).toBeNull()
    expect(wrapper.find('.consultation-banner').exists()).toBe(false)
    // Mode toggle is visible in create mode
    expect(wrapper.find('.mode-toggle').exists()).toBe(true)
  })
})
