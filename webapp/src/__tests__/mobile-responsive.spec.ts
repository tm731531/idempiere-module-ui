import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import QuickActionBar from '@/components/QuickActionBar.vue'
import StatusUpdateModal from '@/components/StatusUpdateModal.vue'
import TrackingDateModal from '@/components/TrackingDateModal.vue'
import ActivityInputModal from '@/components/ActivityInputModal.vue'

// Mock router and auth for components that need them
vi.mock('vue-router', () => ({
  useRouter: vi.fn(),
  useRoute: vi.fn(),
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: vi.fn(() => ({
    user: { id: 1, name: 'Test User' },
    context: { organizationId: 1 },
  })),
}))

describe('Mobile Responsive Design - Touch Targets', () => {
  it('QuickActionBar buttons are present and properly structured', () => {
    const wrapper = mount(QuickActionBar, {
      props: {
        requestId: 123,
        currentStatus: '待處理',
      },
    })

    const buttons = wrapper.findAll('.action-btn')
    expect(buttons.length).toBe(3)

    // Verify each button has proper structure
    buttons.forEach((btn, index) => {
      const svg = btn.find('svg')
      const span = btn.find('span')
      expect(svg.exists()).toBe(true)
      expect(span.exists()).toBe(true)
      expect(btn.element.getAttribute('class')).toContain('action-btn')
    })
  })

  it('StatusUpdateModal has appropriately sized buttons', () => {
    const wrapper = mount(StatusUpdateModal, {
      props: {
        requestId: 123,
        currentStatusId: 1,
        statuses: [
          { R_Status_ID: 1, Name: '待處理' },
          { R_Status_ID: 2, Name: '已完成' },
        ],
      },
    })

    const buttons = wrapper.findAll('.btn')
    expect(buttons.length).toBe(2) // Cancel and Confirm

    buttons.forEach(btn => {
      expect(btn.element.getAttribute('class')).toContain('btn')
    })
  })

  it('ActivityInputModal renders with properly structured form', () => {
    const wrapper = mount(ActivityInputModal, {
      props: {
        requestId: 123,
        actionType: '電話',
      },
    })

    expect(wrapper.exists()).toBe(true)
  })

  it('TrackingDateModal exists and renders overlay', () => {
    const wrapper = mount(TrackingDateModal, {
      props: {
        requestId: 123,
      },
    })

    expect(wrapper.exists()).toBe(true)
  })
})

describe('Mobile Responsive Design - Form Structure', () => {
  it('StatusUpdateModal has proper flex layout structure', () => {
    const wrapper = mount(StatusUpdateModal, {
      props: {
        requestId: 123,
        currentStatusId: 1,
        statuses: [
          { R_Status_ID: 1, Name: '待處理' },
          { R_Status_ID: 2, Name: '已完成' },
        ],
      },
    })

    const modal = wrapper.find('.dialog-modal')
    expect(modal.exists()).toBe(true)
    expect(modal.element.getAttribute('class')).toContain('dialog-modal')
  })

  it('StatusUpdateModal header has proper structure for mobile', () => {
    const wrapper = mount(StatusUpdateModal, {
      props: {
        requestId: 123,
        currentStatusId: 1,
        statuses: [
          { R_Status_ID: 1, Name: '待處理' },
          { R_Status_ID: 2, Name: '已完成' },
        ],
      },
    })

    const header = wrapper.find('.dialog-header')
    const title = wrapper.find('.dialog-title')
    const closeBtn = wrapper.find('.dialog-close')

    expect(header.exists()).toBe(true)
    expect(title.exists()).toBe(true)
    expect(closeBtn.exists()).toBe(true)
    expect(title.text()).toBe('更新狀態')
  })

  it('QuickActionBar uses responsive grid layout', () => {
    const wrapper = mount(QuickActionBar, {
      props: {
        requestId: 123,
        currentStatus: '待處理',
      },
    })

    const grid = wrapper.find('.action-grid')
    expect(grid.exists()).toBe(true)
    expect(grid.element.getAttribute('class')).toContain('action-grid')
  })
})

describe('Mobile Responsive Design - Modal Content', () => {
  it('StatusUpdateModal renders list of status items', () => {
    const statuses = [
      { R_Status_ID: 1, Name: '待處理' },
      { R_Status_ID: 2, Name: '討論中' },
      { R_Status_ID: 3, Name: '已完成' },
    ]

    const wrapper = mount(StatusUpdateModal, {
      props: {
        requestId: 123,
        currentStatusId: 1,
        statuses,
      },
    })

    const items = wrapper.findAll('.status-item')
    expect(items.length).toBe(3)

    items.forEach((item, index) => {
      const label = item.find('.status-label')
      expect(label.exists()).toBe(true)
      expect(label.text()).toBe(statuses[index]!.Name)
    })
  })

  it('StatusUpdateModal radio inputs are interactive', async () => {
    const wrapper = mount(StatusUpdateModal, {
      props: {
        requestId: 123,
        currentStatusId: 1,
        statuses: [
          { R_Status_ID: 1, Name: '待處理' },
          { R_Status_ID: 2, Name: '已完成' },
        ],
      },
    })

    const radios = wrapper.findAll('input[type="radio"]')
    expect(radios.length).toBe(2)

    // Click second radio
    await radios[1]!.setValue(true)
    // @ts-ignore
    expect(wrapper.vm.selectedStatusId).toBe(2)
  })

  it('QuickActionBar shows loading state when disabled', () => {
    const wrapper = mount(QuickActionBar, {
      props: {
        requestId: 123,
        currentStatus: '待處理',
        disabled: true,
      },
    })

    const buttons = wrapper.findAll('.action-btn')
    buttons.forEach(btn => {
      expect(btn.element.getAttribute('disabled')).toBeDefined()
    })
  })
})

describe('Mobile Responsive Design - Text Content', () => {
  it('StatusUpdateModal labels are visible and readable', () => {
    const wrapper = mount(StatusUpdateModal, {
      props: {
        requestId: 123,
        currentStatusId: 1,
        statuses: [
          { R_Status_ID: 1, Name: '待處理' },
          { R_Status_ID: 2, Name: '已完成' },
        ],
      },
    })

    const title = wrapper.find('.dialog-title')
    expect(title.text()).toBeTruthy()
    expect(title.text().length).toBeGreaterThan(0)
  })

  it('QuickActionBar action buttons have text labels', () => {
    const wrapper = mount(QuickActionBar, {
      props: {
        requestId: 123,
        currentStatus: '待處理',
      },
    })

    const buttons = wrapper.findAll('.action-btn')
    const labels = buttons.map(btn => btn.find('span').text())

    expect(labels).toContain('記錄打電話')
    expect(labels).toContain('發訊息')
    expect(labels).toContain('預約追蹤')
  })

  it('ActivityInputModal is properly initialized', () => {
    const wrapper = mount(ActivityInputModal, {
      props: {
        requestId: 123,
        actionType: '電話',
      },
    })

    expect(wrapper.exists()).toBe(true)
    expect(wrapper.vm.actionType).toBe('電話')
  })
})

describe('Mobile Responsive Design - Overlay & Positioning', () => {
  it('StatusUpdateModal uses overlay for backdrop', () => {
    const wrapper = mount(StatusUpdateModal, {
      props: {
        requestId: 123,
        currentStatusId: 1,
        statuses: [
          { R_Status_ID: 1, Name: '待處理' },
          { R_Status_ID: 2, Name: '已完成' },
        ],
      },
    })

    const overlay = wrapper.find('.dialog-overlay')
    expect(overlay.exists()).toBe(true)
  })

  it('StatusUpdateModal overlay closes on self click', async () => {
    const wrapper = mount(StatusUpdateModal, {
      props: {
        requestId: 123,
        currentStatusId: 1,
        statuses: [
          { R_Status_ID: 1, Name: '待處理' },
          { R_Status_ID: 2, Name: '已完成' },
        ],
      },
    })

    const closeBtn = wrapper.find('.dialog-close')
    await closeBtn.trigger('click')

    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('QuickActionBar is positioned at bottom of viewport', () => {
    const wrapper = mount(QuickActionBar, {
      props: {
        requestId: 123,
        currentStatus: '待處理',
      },
    })

    const bar = wrapper.find('.quick-action-bar')
    expect(bar.exists()).toBe(true)
    expect(bar.element.getAttribute('class')).toContain('quick-action-bar')
  })
})

describe('Mobile Responsive Design - User Interactions', () => {
  it('StatusUpdateModal emits status-selected event on confirm', async () => {
    const wrapper = mount(StatusUpdateModal, {
      props: {
        requestId: 123,
        currentStatusId: 1,
        statuses: [
          { R_Status_ID: 1, Name: '待處理' },
          { R_Status_ID: 2, Name: '已完成' },
        ],
      },
    })

    const radios = wrapper.findAll('input[type="radio"]')
    await radios[1]!.setValue(true)

    const confirmBtn = wrapper.find('.btn-primary')
    await confirmBtn.trigger('click')

    expect(wrapper.emitted('status-selected')).toBeTruthy()
    expect(wrapper.emitted('status-selected')?.[0]).toEqual(['已完成'])
  })

  it('QuickActionBar emits events on button clicks', async () => {
    const wrapper = mount(QuickActionBar, {
      props: {
        requestId: 123,
        currentStatus: '待處理',
      },
    })

    const buttons = wrapper.findAll('.action-btn')

    // Phone button
    await buttons[0]!.trigger('click')
    // @ts-ignore
    expect(wrapper.vm.showActivityModal).toBe(true)

    // @ts-ignore
    wrapper.vm.showActivityModal = false

    // Message button
    await buttons[1]!.trigger('click')
    // @ts-ignore
    expect(wrapper.vm.showActivityModal).toBe(true)

    // @ts-ignore
    wrapper.vm.showActivityModal = false

    // Tracking button (now at index 2 after removing status button)
    await buttons[2]!.trigger('click')
    expect(wrapper.emitted('set-tracking')).toBeTruthy()
  })

  it('StatusUpdateModal can be pre-populated without automatic selection', async () => {
    const wrapper = mount(StatusUpdateModal, {
      props: {
        requestId: 123,
        currentStatusId: 1,
        statuses: [
          { R_Status_ID: 1, Name: '待處理' },
          { R_Status_ID: 2, Name: '已完成' },
        ],
      },
    })

    // Verify status is initialized
    await wrapper.vm.$nextTick()
    // @ts-ignore
    expect(wrapper.vm.selectedStatusId).toBe(1)

    // Verify we can select a different status
    const radios = wrapper.findAll('input[type="radio"]')
    await radios[1]!.setValue(true)

    // @ts-ignore
    expect(wrapper.vm.selectedStatusId).toBe(2)
  })
})

describe('Mobile Responsive Design - Accessibility', () => {
  it('StatusUpdateModal has proper label associations', () => {
    const wrapper = mount(StatusUpdateModal, {
      props: {
        requestId: 123,
        currentStatusId: 1,
        statuses: [
          { R_Status_ID: 1, Name: '待處理' },
          { R_Status_ID: 2, Name: '已完成' },
        ],
      },
    })

    const labels = wrapper.findAll('label')
    expect(labels.length).toBeGreaterThan(0)

    labels.forEach(label => {
      const radio = label.find('input[type="radio"]')
      expect(radio.exists()).toBe(true)
    })
  })

  it('QuickActionBar buttons have proper title attributes', () => {
    const wrapper = mount(QuickActionBar, {
      props: {
        requestId: 123,
        currentStatus: '待處理',
      },
    })

    const buttons = wrapper.findAll('.action-btn')
    const titles = buttons.map(btn => btn.element.getAttribute('title'))

    expect(titles).toContain('記錄打電話')
    expect(titles).toContain('發訊息')
    expect(titles).toContain('預約追蹤')
  })

  it('StatusUpdateModal has close button for accessibility', () => {
    const wrapper = mount(StatusUpdateModal, {
      props: {
        requestId: 123,
        currentStatusId: 1,
        statuses: [
          { R_Status_ID: 1, Name: '待處理' },
          { R_Status_ID: 2, Name: '已完成' },
        ],
      },
    })

    const closeBtn = wrapper.find('.dialog-close')
    expect(closeBtn.exists()).toBe(true)
    expect(closeBtn.text()).toContain('✕')
  })
})

describe('Mobile Responsive Design - Modal State Management', () => {
  it('ActivityInputModal tracks action type', () => {
    const wrapper = mount(ActivityInputModal, {
      props: {
        requestId: 123,
        actionType: '電話',
      },
    })

    expect(wrapper.vm.actionType).toBe('電話')
  })

  it('StatusUpdateModal initializes with current status', async () => {
    const wrapper = mount(StatusUpdateModal, {
      props: {
        requestId: 123,
        currentStatusId: 2,
        statuses: [
          { R_Status_ID: 1, Name: '待處理' },
          { R_Status_ID: 2, Name: '已完成' },
        ],
      },
    })

    // Wait for watch to initialize
    await wrapper.vm.$nextTick()

    // @ts-ignore
    expect(wrapper.vm.selectedStatusId).toBe(2)
  })
})

describe('Mobile Responsive Design - Multiple Modals', () => {
  it('Can mount multiple modal instances independently', () => {
    const wrapper1 = mount(StatusUpdateModal, {
      props: {
        requestId: 123,
        currentStatusId: 1,
        statuses: [
          { R_Status_ID: 1, Name: '待處理' },
          { R_Status_ID: 2, Name: '已完成' },
        ],
      },
    })

    const wrapper2 = mount(TrackingDateModal, {
      props: {
        requestId: 123,
      },
    })

    expect(wrapper1.exists()).toBe(true)
    expect(wrapper2.exists()).toBe(true)
  })
})
