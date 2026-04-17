import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import RequestFormView from '../RequestFormView.vue'
import { useAuthStore } from '@/stores/auth'
import { useRouter, useRoute } from 'vue-router'

// Mock dependencies
vi.mock('vue-router', () => ({
  useRouter: vi.fn(),
  useRoute: vi.fn(),
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: vi.fn(),
}))

vi.mock('@/composables/useDocumentForm', () => {
  return {
    useDocumentForm: vi.fn(() => {
      const formData = ref({
        R_RequestType_ID: { id: 1, identifier: 'Type 1' },
        Summary: 'Test summary',
        Description: '[]',
        R_Status_ID: { id: 1, identifier: 'New' },
      })
      return {
        visibleFieldDefs: [],
        formData,
        pageLoading: ref(false),
        pageError: ref(''),
        docStatus: ref('DR'),
        readOnly: false,
        isCreate: false,
        load: vi.fn(),
        loadFields: vi.fn(),
        initDefaults: vi.fn(),
        getFormPayload: vi.fn(() => ({
          R_RequestType_ID: 1,
          Summary: 'Test summary',
          AD_Org_ID: 0,
        })),
        populateFromRecord: vi.fn(),
      }
    }),
  }
})

vi.mock('@/composables/useAttachment', () => ({
  useAttachment: vi.fn(() => ({
    attachments: [],
    uploading: false,
    error: '',
    thumbnailUrls: new Map(),
    loadAttachments: vi.fn(),
    upload: vi.fn(),
    remove: vi.fn(),
  })),
}))

vi.mock('@/api/request', () => ({
  getRequest: vi.fn(),
  createRequest: vi.fn(),
  updateRequest: vi.fn(),
  listRequestStatuses: vi.fn(() => Promise.resolve([
    { R_Status_ID: 1, Name: '待處理', SeqNo: 1 },
    { R_Status_ID: 2, Name: '已完成', SeqNo: 2 },
  ])),
}))

vi.mock('@/api/adNote', () => ({
  listNotesForRecord: vi.fn(() => Promise.resolve([])),
  createNote: vi.fn(() => Promise.resolve({
    id: 1,
    AD_Table_ID: 100,
    Record_ID: 123,
    Description: 'NOTE',
    TextMsg: 'Test note',
    Created: '2026-01-01T00:00:00Z',
    CreatedBy: 1,
  })),
  getRRequestTableId: vi.fn(() => Promise.resolve(100)),
}))

vi.mock('@/api/sysconfig', () => ({
  getSysConfig: vi.fn(() => Promise.resolve(null)),
}))

describe('RequestFormView', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    const mockRouter = {
      push: vi.fn(),
    }

    const mockRoute = {
      params: { id: '123' },
    }

    vi.mocked(useRouter).mockReturnValue(mockRouter as any)
    vi.mocked(useRoute).mockReturnValue(mockRoute as any)

    vi.mocked(useAuthStore).mockReturnValue({
      user: { id: 1, name: 'Test User', role: 'admin' },
      context: { organizationId: 1, warehouseId: 1, clientId: 1 },
      token: 'mock-token',
    } as any)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('RequestTimeline renders in edit mode', async () => {
    const wrapper = mount(RequestFormView, {
      global: {
        stubs: {
          RequestTimeline: true,
          QuickActionBar: true,
          DynamicForm: true,
        },
      },
    })

    await flushPromises()
    await wrapper.vm.$nextTick()

    const timeline = wrapper.findComponent({ name: 'RequestTimeline' })
    expect(timeline.exists()).toBe(true)
  })

  it('renders QuickActionBar when editing', async () => {
    const wrapper = mount(RequestFormView, {
      global: {
        stubs: {
          RequestTimeline: true,
          QuickActionBar: true,
          DynamicForm: true,
        },
      },
    })

    await flushPromises()
    await wrapper.vm.$nextTick()

    const actionBar = wrapper.findComponent({ name: 'QuickActionBar' })
    expect(actionBar.exists()).toBe(true)
  })

  it('does not render RequestTimeline or QuickActionBar when creating', async () => {
    const mockRoute = {
      params: {},
    }
    vi.mocked(useRoute).mockReturnValue(mockRoute as any)

    const wrapper = mount(RequestFormView, {
      global: {
        stubs: {
          RequestTimeline: true,
          QuickActionBar: true,
          DynamicForm: true,
        },
      },
    })

    await wrapper.vm.$nextTick()

    const timeline = wrapper.findComponent({ name: 'RequestTimeline' })
    const actionBar = wrapper.findComponent({ name: 'QuickActionBar' })

    expect(timeline.exists()).toBe(false)
    expect(actionBar.exists()).toBe(false)
  })

  it('handleAddActivity calls createNote API and refreshes timeline', async () => {
    const { createNote, listNotesForRecord } = await import('@/api/adNote')

    const wrapper = mount(RequestFormView, {
      global: {
        stubs: {
          RequestTimeline: true,
          DynamicForm: true,
          QuickActionBar: true,
        },
      },
    })

    await flushPromises()
    await wrapper.vm.$nextTick()

    // Directly call the handler method
    // @ts-ignore
    await wrapper.vm.handleAddActivity({
      type: 'NOTE',
      actionType: 'NOTE',
      content: '客戶已確認',
    })

    await flushPromises()

    // createNote should have been called with the activity data
    expect(createNote).toHaveBeenCalledWith(
      expect.objectContaining({
        Record_ID: 123,
        Description: 'NOTE',
        TextMsg: '客戶已確認',
      })
    )

    // Timeline should refresh — listNotesForRecord called again after create
    expect(listNotesForRecord).toHaveBeenCalledTimes(2) // once on mount, once after add
  })

  it('handleAddActivity stores call-type activity as JSON in TextMsg', async () => {
    const { createNote } = await import('@/api/adNote')

    const wrapper = mount(RequestFormView, {
      global: {
        stubs: {
          RequestTimeline: true,
          DynamicForm: true,
          QuickActionBar: true,
        },
      },
    })

    await flushPromises()
    await wrapper.vm.$nextTick()

    // @ts-ignore
    await wrapper.vm.handleAddActivity({
      type: 'CALL',
      actionType: '電話',
      content: '客戶表示明天方便',
    })

    await flushPromises()

    expect(createNote).toHaveBeenCalledWith(
      expect.objectContaining({
        Description: 'CALL',
        TextMsg: JSON.stringify({ summary: '客戶表示明天方便' }),
      })
    )
  })

  it('handleAddActivity does not set error message on success', async () => {
    const wrapper = mount(RequestFormView, {
      global: {
        stubs: {
          RequestTimeline: true,
          DynamicForm: true,
          QuickActionBar: true,
        },
      },
    })

    await flushPromises()
    await wrapper.vm.$nextTick()

    // @ts-ignore
    await wrapper.vm.handleAddActivity({
      type: 'NOTE',
      content: '測試備註',
    })

    await flushPromises()

    // @ts-ignore
    expect(wrapper.vm.errorMsg).toBe('')
  })

  it('passes correct props to QuickActionBar', async () => {
    const wrapper = mount(RequestFormView, {
      global: {
        stubs: {
          RequestTimeline: true,
          QuickActionBar: true,
          DynamicForm: true,
        },
      },
    })

    await wrapper.vm.$nextTick()

    const actionBar = wrapper.findComponent({ name: 'QuickActionBar' })
    expect(actionBar.exists()).toBe(true)
    expect(actionBar.props('requestId')).toBe(123)
    expect(actionBar.props('disabled')).toBe(false)
  })

  it('passes activities JSON string to RequestTimeline', async () => {
    const { listNotesForRecord } = await import('@/api/adNote')
    vi.mocked(listNotesForRecord).mockResolvedValueOnce([
      {
        id: 1,
        AD_Table_ID: 100,
        Record_ID: 123,
        Description: 'NOTE',
        TextMsg: 'Test note content',
        Created: '2026-01-15T10:00:00Z',
        CreatedBy: { id: 1, identifier: 'Test User' },
      },
    ])

    const wrapper = mount(RequestFormView, {
      global: {
        stubs: {
          RequestTimeline: true,
          QuickActionBar: true,
          DynamicForm: true,
        },
      },
    })

    await flushPromises()
    await wrapper.vm.$nextTick()

    const timeline = wrapper.findComponent({ name: 'RequestTimeline' })
    expect(timeline.exists()).toBe(true)
    // The activities prop should be a JSON string
    const activitiesProp = timeline.props('activities')
    expect(typeof activitiesProp).toBe('string')
    const parsed = JSON.parse(activitiesProp)
    expect(Array.isArray(parsed)).toBe(true)
    expect(parsed[0]).toMatchObject({
      type: 'NOTE',
      content: 'Test note content',
      createdBy: 'Test User',
    })
  })
})
