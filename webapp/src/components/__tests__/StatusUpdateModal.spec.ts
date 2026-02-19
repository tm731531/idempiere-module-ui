import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import StatusUpdateModal from '../StatusUpdateModal.vue'

describe('StatusUpdateModal', () => {
  const mockStatuses = [
    { R_Status_ID: 1, Name: '待處理' },
    { R_Status_ID: 2, Name: '討論中' },
    { R_Status_ID: 3, Name: '等待回應' },
    { R_Status_ID: 4, Name: '已指派' },
    { R_Status_ID: 5, Name: '已完成' },
  ]

  it('renders modal with title and all status options', () => {
    const wrapper = mount(StatusUpdateModal, {
      props: {
        requestId: 123,
        currentStatusId: 2,
        statuses: mockStatuses,
      },
    })

    expect(wrapper.text()).toContain('更新狀態')
    expect(wrapper.text()).toContain('待處理')
    expect(wrapper.text()).toContain('討論中')
    expect(wrapper.text()).toContain('等待回應')
    expect(wrapper.text()).toContain('已指派')
    expect(wrapper.text()).toContain('已完成')
  })

  it('checks radio button for current status', () => {
    const wrapper = mount(StatusUpdateModal, {
      props: {
        requestId: 123,
        currentStatusId: 2,
        statuses: mockStatuses,
      },
    })

    const radios = wrapper.findAll('input[type="radio"]')
    expect(radios.length).toBe(5)
    expect((radios[1]!.element as HTMLInputElement).checked).toBe(true)
  })

  it('emits status-selected when confirm button is clicked', async () => {
    const wrapper = mount(StatusUpdateModal, {
      props: {
        requestId: 123,
        currentStatusId: 2,
        statuses: mockStatuses,
      },
    })

    // Select a different status
    const radios = wrapper.findAll('input[type="radio"]')
    await radios[3]!.setValue(true)

    // Click confirm button
    const buttons = wrapper.findAll('button')
    const confirmBtn = buttons.find(b => b.text().includes('確認'))
    await confirmBtn?.trigger('click')

    expect(wrapper.emitted('status-selected')).toBeTruthy()
    const emitted = wrapper.emitted('status-selected')?.[0] as any[]
    expect(emitted[0]).toBe(4)
  })

  it('emits close event when cancel button is clicked', async () => {
    const wrapper = mount(StatusUpdateModal, {
      props: {
        requestId: 123,
        currentStatusId: 2,
        statuses: mockStatuses,
      },
    })

    const buttons = wrapper.findAll('button')
    const cancelBtn = buttons.find(b => b.text().includes('取消'))
    await cancelBtn?.trigger('click')

    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('emits close when overlay is clicked', async () => {
    const wrapper = mount(StatusUpdateModal, {
      props: {
        requestId: 123,
        currentStatusId: 2,
        statuses: mockStatuses,
      },
    })

    const overlay = wrapper.find('.dialog-overlay')
    await overlay.trigger('click')

    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('renders hardcoded statuses when no statuses provided', () => {
    const wrapper = mount(StatusUpdateModal, {
      props: {
        requestId: 123,
        currentStatusId: 1,
        statuses: [],
      },
    })

    // Should display empty state when no statuses provided (API has none)
    expect(wrapper.text()).toContain('無可用狀態')
  })

  it('handles numeric currentStatusId correctly', () => {
    const wrapper = mount(StatusUpdateModal, {
      props: {
        requestId: 123,
        currentStatusId: 3,
        statuses: mockStatuses,
      },
    })

    const radios = wrapper.findAll('input[type="radio"]')
    expect((radios[2]!.element as HTMLInputElement).checked).toBe(true)
  })

  it('handles string currentStatusId correctly', () => {
    const wrapper = mount(StatusUpdateModal, {
      props: {
        requestId: 123,
        currentStatusId: '2',
        statuses: mockStatuses,
      },
    })

    const radios = wrapper.findAll('input[type="radio"]')
    expect((radios[1]!.element as HTMLInputElement).checked).toBe(true)
  })

  it('shows error when confirm button is clicked without selection', async () => {
    const wrapper = mount(StatusUpdateModal, {
      props: {
        requestId: 123,
        currentStatusId: 2,
        statuses: mockStatuses,
      },
    })

    // Deselect all radios by setting selectedStatusId to null
    // @ts-ignore
    wrapper.vm.selectedStatusId = null
    await wrapper.vm.$nextTick()

    // Call handleConfirm directly to simulate click
    // @ts-ignore
    wrapper.vm.handleConfirm()
    await wrapper.vm.$nextTick()

    // @ts-ignore
    expect(wrapper.vm.showError).toBe(true)
    expect(wrapper.text()).toContain('請選擇狀態')
  })

  it('hides error message when status is selected', async () => {
    const wrapper = mount(StatusUpdateModal, {
      props: {
        requestId: 123,
        currentStatusId: 2,
        statuses: mockStatuses,
      },
    })

    // Clear error state
    // @ts-ignore
    wrapper.vm.showError = true
    await wrapper.vm.$nextTick()

    // Select a status
    const radios = wrapper.findAll('input[type="radio"]')
    await radios[2]!.setValue(true)
    await wrapper.vm.$nextTick()

    // Click confirm
    const buttons = wrapper.findAll('button')
    const confirmBtn = buttons.find(b => b.text().includes('確認'))
    await confirmBtn?.trigger('click')

    // Error should be cleared and event emitted
    // @ts-ignore
    expect(wrapper.vm.showError).toBe(false)
    expect(wrapper.emitted('status-selected')).toBeTruthy()
  })

  it('disables confirm button when no status selected', async () => {
    const wrapper = mount(StatusUpdateModal, {
      props: {
        requestId: 123,
        currentStatusId: 2,
        statuses: mockStatuses,
      },
    })

    // Reset selection
    // @ts-ignore
    wrapper.vm.selectedStatusId = null
    await wrapper.vm.$nextTick()

    const buttons = wrapper.findAll('button')
    const confirmBtn = buttons.find(b => b.text().includes('確認'))
    expect(confirmBtn?.attributes('disabled')).toBeDefined()
  })

  it('enables confirm button when status is selected', async () => {
    const wrapper = mount(StatusUpdateModal, {
      props: {
        requestId: 123,
        currentStatusId: 2,
        statuses: mockStatuses,
      },
    })

    // Select a different status
    const radios = wrapper.findAll('input[type="radio"]')
    await radios[3]!.setValue(true)
    await wrapper.vm.$nextTick()

    const buttons = wrapper.findAll('button')
    const confirmBtn = buttons.find(b => b.text().includes('確認'))
    expect(confirmBtn?.attributes('disabled')).toBeUndefined()
  })
})
