import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import TrackingDateModal from '../TrackingDateModal.vue'

describe('TrackingDateModal', () => {
  it('renders modal with title and date/time/description inputs', () => {
    const wrapper = mount(TrackingDateModal, {
      props: {
        requestId: 123,
      },
    })

    expect(wrapper.text()).toContain('預約追蹤')
    expect(wrapper.find('input[type="date"]').exists()).toBe(true)
    expect(wrapper.find('input[type="time"]').exists()).toBe(true)
    expect(wrapper.find('textarea').exists()).toBe(true)
  })

  it('displays character counter for description', () => {
    const wrapper = mount(TrackingDateModal, {
      props: {
        requestId: 123,
      },
    })

    expect(wrapper.text()).toContain('0/200')
  })

  it('initializes date to today if not provided', () => {
    const wrapper = mount(TrackingDateModal, {
      props: {
        requestId: 123,
      },
    })

    const today = new Date().toISOString().split('T')[0]
    const dateInput = wrapper.find('input[type="date"]')
    expect((dateInput.element as HTMLInputElement).value).toBe(today)
  })

  it('initializes time to current time', () => {
    const wrapper = mount(TrackingDateModal, {
      props: {
        requestId: 123,
      },
    })

    const timeInput = wrapper.find('input[type="time"]').element as HTMLInputElement
    // Just check that time is set (format HH:MM)
    expect(timeInput.value).toMatch(/^\d{2}:\d{2}$/)
  })

  it('emits tracking-set when confirm button is clicked', async () => {
    const wrapper = mount(TrackingDateModal, {
      props: {
        requestId: 123,
      },
    })

    // Set date and time
    const dateInput = wrapper.find('input[type="date"]')
    const timeInput = wrapper.find('input[type="time"]')
    const descriptionInput = wrapper.find('textarea')

    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = tomorrow.toISOString().split('T')[0]

    await dateInput.setValue(tomorrowStr)
    await timeInput.setValue('14:00')
    await descriptionInput.setValue('追蹤護理進度')

    // Click confirm
    const buttons = wrapper.findAll('button')
    const confirmBtn = buttons.find(b => b.text().includes('確認'))
    await confirmBtn?.trigger('click')

    expect(wrapper.emitted('tracking-set')).toBeTruthy()
    const emitted = wrapper.emitted('tracking-set')[0] as any[]
    expect(emitted[0].date).toBe(tomorrowStr)
    expect(emitted[0].time).toBe('14:00')
    expect(emitted[0].description).toBe('追蹤護理進度')
  })

  it('emits close when cancel button is clicked', async () => {
    const wrapper = mount(TrackingDateModal, {
      props: {
        requestId: 123,
      },
    })

    const buttons = wrapper.findAll('button')
    const cancelBtn = buttons.find(b => b.text().includes('取消'))
    await cancelBtn?.trigger('click')

    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('emits close when overlay is clicked', async () => {
    const wrapper = mount(TrackingDateModal, {
      props: {
        requestId: 123,
      },
    })

    const overlay = wrapper.find('.dialog-overlay')
    await overlay.trigger('click')

    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('updates character counter while typing', async () => {
    const wrapper = mount(TrackingDateModal, {
      props: {
        requestId: 123,
      },
    })

    const descriptionInput = wrapper.find('textarea')
    await descriptionInput.setValue('測試描述')

    expect(wrapper.text()).toContain('4/200')
  })

  it('prevents description from exceeding 200 characters', async () => {
    const wrapper = mount(TrackingDateModal, {
      props: {
        requestId: 123,
      },
    })

    const descriptionInput = wrapper.find('textarea')
    const longText = 'a'.repeat(201)
    await descriptionInput.setValue(longText)

    const textarea = descriptionInput.element as HTMLTextAreaElement
    expect(textarea.value.length).toBeLessThanOrEqual(200)
  })

  it('disables confirm button if date is in the past', async () => {
    const wrapper = mount(TrackingDateModal, {
      props: {
        requestId: 123,
      },
    })

    const dateInput = wrapper.find('input[type="date"]')
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split('T')[0]

    await dateInput.setValue(yesterdayStr)

    const buttons = wrapper.findAll('button')
    const confirmBtn = buttons.find(b => b.text().includes('確認'))
    expect(confirmBtn?.attributes('disabled')).toBeDefined()
  })

  it('enables confirm button if date is today or future', async () => {
    const wrapper = mount(TrackingDateModal, {
      props: {
        requestId: 123,
      },
    })

    const dateInput = wrapper.find('input[type="date"]')
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = tomorrow.toISOString().split('T')[0]

    await dateInput.setValue(tomorrowStr)
    await wrapper.find('input[type="time"]').setValue('14:00')

    const buttons = wrapper.findAll('button')
    const confirmBtn = buttons.find(b => b.text().includes('確認'))
    expect(confirmBtn?.attributes('disabled')).toBeUndefined()
  })

  it('uses provided initialDate prop', () => {
    const wrapper = mount(TrackingDateModal, {
      props: {
        requestId: 123,
        initialDate: '2026-03-20',
      },
    })

    const dateInput = wrapper.find('input[type="date"]')
    expect((dateInput.element as HTMLInputElement).value).toBe('2026-03-20')
  })
})
