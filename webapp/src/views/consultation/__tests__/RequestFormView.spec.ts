import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
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
  const { ref } = require('vue')
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
        pageLoading: false,
        pageError: '',
        readOnly: false,
        isCreate: false,
        load: vi.fn(),
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

  it('renders RequestTimeline when editing', async () => {
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
    wrapper.vm.handleAddActivity({
      type: '前台行動',
      actionType: '打電話',
      content: '客戶已確認',
      timestamp: '2026-02-19T10:00:00Z',
      createdBy: 'Test User',
    })

    // Verify formData.Description was updated
    const activities = JSON.parse(wrapper.vm.formData.Description || '[]')
    expect(activities).toHaveLength(1)
    expect(activities[0].actionType).toBe('打電話')
    expect(activities[0].content).toBe('客戶已確認')
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

  it('passes correct props to RequestTimeline', async () => {
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
    expect(timeline.exists()).toBe(true)
    expect(timeline.props('activities')).toBe('[]')
  })
})
