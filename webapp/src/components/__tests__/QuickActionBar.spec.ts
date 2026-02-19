import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import QuickActionBar from '../QuickActionBar.vue'

describe('QuickActionBar', () => {
  it('renders all action buttons', () => {
    const wrapper = mount(QuickActionBar, {
      props: {
        requestId: 123,
        currentStatus: '待處理',
      },
    })

    expect(wrapper.text()).toContain('記錄打電話')
    expect(wrapper.text()).toContain('發訊息')
    expect(wrapper.text()).toContain('更新狀態')
    expect(wrapper.text()).toContain('預約追蹤')
  })

  it('shows activity modal when phone button clicked', async () => {
    const wrapper = mount(QuickActionBar, {
      props: {
        requestId: 123,
        currentStatus: '待處理',
      },
    })

    const buttons = wrapper.findAll('.action-btn')
    await buttons[0]!.trigger('click')
    await wrapper.vm.$nextTick()

    // Modal should be shown
    // @ts-ignore
    expect(wrapper.vm.showActivityModal).toBe(true)
    // @ts-ignore
    expect(wrapper.vm.activityActionType).toBe('電話')
  })

  it('shows activity modal when message button clicked', async () => {
    const wrapper = mount(QuickActionBar, {
      props: {
        requestId: 123,
        currentStatus: '待處理',
      },
    })

    const buttons = wrapper.findAll('.action-btn')
    await buttons[1]!.trigger('click')
    await wrapper.vm.$nextTick()

    // Modal should be shown
    // @ts-ignore
    expect(wrapper.vm.showActivityModal).toBe(true)
    // @ts-ignore
    expect(wrapper.vm.activityActionType).toBe('訊息')
  })

  it('forwards activity-added event from modal', async () => {
    const wrapper = mount(QuickActionBar, {
      props: {
        requestId: 123,
        currentStatus: '待處理',
      },
    })

    const activity = {
      type: '前台行動',
      actionType: '打電話',
      content: 'Test call',
      timestamp: '2026-02-19T10:00:00Z',
      createdBy: 'Test User',
    }

    // Call the handler directly
    // @ts-ignore
    wrapper.vm.handleActivityAdded(activity)
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('add-activity')).toBeTruthy()
    expect(wrapper.emitted('add-activity')?.[0]?.[0]).toEqual(activity)
  })

  it('emits update-status event when status button clicked', async () => {
    const wrapper = mount(QuickActionBar, {
      props: {
        requestId: 123,
        currentStatus: '待處理',
      },
    })

    const buttons = wrapper.findAll('button')
    await buttons[2]!.trigger('click')

    expect(wrapper.emitted('update-status')).toBeTruthy()
    const emitted = wrapper.emitted('update-status')?.[0] as any[]
    expect(emitted?.[0]?.requestId).toBe(123)
  })

  it('emits set-tracking event when tracking button clicked', async () => {
    const wrapper = mount(QuickActionBar, {
      props: {
        requestId: 123,
        currentStatus: '待處理',
      },
    })

    const buttons = wrapper.findAll('button')
    await buttons[3]!.trigger('click')

    expect(wrapper.emitted('set-tracking')).toBeTruthy()
    const emitted = wrapper.emitted('set-tracking')?.[0] as any[]
    expect(emitted?.[0]?.requestId).toBe(123)
  })

  it('disables all buttons when disabled prop is true', () => {
    const wrapper = mount(QuickActionBar, {
      props: {
        requestId: 123,
        currentStatus: '待處理',
        disabled: true,
      },
    })

    const buttons = wrapper.findAll('button')
    buttons.forEach(btn => {
      expect(btn.attributes('disabled')).toBeDefined()
    })
  })
})
