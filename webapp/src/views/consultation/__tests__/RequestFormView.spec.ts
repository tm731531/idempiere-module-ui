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

  it('RequestTimeline is not rendered (temporarily disabled)', async () => {
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
    expect(timeline.exists()).toBe(false)
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

  it('handles add-activity event from QuickActionBar', async () => {
    const wrapper = mount(RequestFormView, {
      global: {
        stubs: {
          RequestTimeline: true,
          DynamicForm: true,
        },
      },
    })

    await wrapper.vm.$nextTick()

    // Directly call the handler method instead of triggering emit
    // @ts-ignore
    wrapper.vm.handleAddActivity({
      type: '前台行動',
      actionType: '打電話',
      content: '客戶已確認',
      timestamp: '2026-02-19T10:00:00Z',
      createdBy: 'Test User',
    })

    // Verify error message is shown (activity feature temporarily disabled)
    // @ts-ignore
    expect(wrapper.vm.errorMsg).toBe('活動功能暫時不可用')
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

  it('RequestTimeline is temporarily disabled', async () => {
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

    // Activity Timeline is temporarily disabled until proper storage is found
    const timeline = wrapper.findComponent({ name: 'RequestTimeline' })
    expect(timeline.exists()).toBe(false)
  })
})
