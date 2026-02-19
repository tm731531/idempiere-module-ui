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

  it('emits add-activity event when phone button clicked', async () => {
    const wrapper = mount(QuickActionBar, {
      props: {
        requestId: 123,
        currentStatus: '待處理',
      },
    })

    // 找到第一個按鈕（記錄打電話）並點擊
    const buttons = wrapper.findAll('button')
    await buttons[0].trigger('click')

    expect(wrapper.emitted('add-activity')).toBeTruthy()
    const emitted = wrapper.emitted('add-activity')[0] as any[]
    expect(emitted[0].type).toBe('前台行動')
    expect(emitted[0].actionType).toBe('打電話')
  })

  it('emits add-activity event when message button clicked', async () => {
    const wrapper = mount(QuickActionBar, {
      props: {
        requestId: 123,
        currentStatus: '待處理',
      },
    })

    const buttons = wrapper.findAll('button')
    await buttons[1].trigger('click')

    expect(wrapper.emitted('add-activity')).toBeTruthy()
    const emitted = wrapper.emitted('add-activity')[0] as any[]
    expect(emitted[0].actionType).toBe('發訊息')
  })

  it('emits update-status event when status button clicked', async () => {
    const wrapper = mount(QuickActionBar, {
      props: {
        requestId: 123,
        currentStatus: '待處理',
      },
    })

    const buttons = wrapper.findAll('button')
    await buttons[2].trigger('click')

    expect(wrapper.emitted('update-status')).toBeTruthy()
  })

  it('emits set-tracking event when tracking button clicked', async () => {
    const wrapper = mount(QuickActionBar, {
      props: {
        requestId: 123,
        currentStatus: '待處理',
      },
    })

    const buttons = wrapper.findAll('button')
    await buttons[3].trigger('click')

    expect(wrapper.emitted('set-tracking')).toBeTruthy()
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
