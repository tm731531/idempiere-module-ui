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
    const emitted = wrapper.emitted('tracking-set')?.[0] as any[]
    expect(emitted?.[0]?.date).toBe(tomorrowStr)
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
    await wrapper.find('textarea').setValue('Valid description')
    await wrapper.vm.$nextTick()

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

  it('shows error when description is empty', async () => {
    const wrapper = mount(TrackingDateModal, {
      props: {
        requestId: 123,
      },
    })

    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = tomorrow.toISOString().split('T')[0]

    await wrapper.find('input[type="date"]').setValue(tomorrowStr)
    await wrapper.find('input[type="time"]').setValue('14:00')
    await wrapper.find('textarea').setValue('')

    // Call validate
    // @ts-ignore
    wrapper.vm.validateForm()
    await wrapper.vm.$nextTick()

    // @ts-ignore
    expect(wrapper.vm.validationErrors.description).toContain('請輸入追蹤說明')
  })

  it('shows error when time is outside business hours', async () => {
    const wrapper = mount(TrackingDateModal, {
      props: {
        requestId: 123,
      },
    })

    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = tomorrow.toISOString().split('T')[0]

    await wrapper.find('input[type="date"]').setValue(tomorrowStr)
    await wrapper.find('input[type="time"]').setValue('21:00') // Outside business hours
    await wrapper.find('textarea').setValue('Test')

    // @ts-ignore
    wrapper.vm.validateForm()
    await wrapper.vm.$nextTick()

    // @ts-ignore
    expect(wrapper.vm.validationErrors.time).toContain('08:00-20:00')
  })

  it('shows error when date is more than 90 days in future', async () => {
    const wrapper = mount(TrackingDateModal, {
      props: {
        requestId: 123,
      },
    })

    const future = new Date()
    future.setDate(future.getDate() + 91)
    const pad = (n: number) => String(n).padStart(2, '0')
    const futureStr = `${future.getFullYear()}-${pad(future.getMonth() + 1)}-${pad(future.getDate())}`

    await wrapper.find('input[type="date"]').setValue(futureStr)
    await wrapper.find('input[type="time"]').setValue('14:00')
    await wrapper.find('textarea').setValue('Test')

    // @ts-ignore
    wrapper.vm.validateForm()
    await wrapper.vm.$nextTick()

    // @ts-ignore
    expect(wrapper.vm.validationErrors.date).toContain('超過90天')
  })

  it('disables confirm button when validation errors exist', async () => {
    const wrapper = mount(TrackingDateModal, {
      props: {
        requestId: 123,
      },
    })

    // Clear date input to leave it empty
    const dateInput = wrapper.find('input[type="date"]')
    await dateInput.setValue('')
    await wrapper.find('input[type="time"]').setValue('14:00')
    await wrapper.find('textarea').setValue('Test')

    await wrapper.vm.$nextTick()

    const buttons = wrapper.findAll('button')
    const confirmBtn = buttons.find(b => b.text().includes('確認'))
    expect(confirmBtn?.attributes('disabled')).toBeDefined()
  })

  it('shows error alert when validation fails', async () => {
    const wrapper = mount(TrackingDateModal, {
      props: {
        requestId: 123,
      },
    })

    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = tomorrow.toISOString().split('T')[0]

    await wrapper.find('input[type="date"]').setValue(tomorrowStr)
    await wrapper.find('input[type="time"]').setValue('21:00')
    await wrapper.find('textarea').setValue('')

    // Trigger validation
    // @ts-ignore
    wrapper.vm.validateForm()
    await wrapper.vm.$nextTick()

    // Should show error alert
    expect(wrapper.find('.error-alert').exists()).toBe(true)
  })

  it('dismisses error alert when dismiss button is clicked', async () => {
    const wrapper = mount(TrackingDateModal, {
      props: {
        requestId: 123,
      },
    })

    // Set an error manually
    // @ts-ignore
    wrapper.vm.validationErrors = { time: 'Test error' }
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.error-alert').exists()).toBe(true)

    const dismissBtn = wrapper.find('.error-close')
    await dismissBtn.trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.error-alert').exists()).toBe(false)
  })

  it('validates all fields are required (date, time, description)', async () => {
    const wrapper = mount(TrackingDateModal, {
      props: {
        requestId: 123,
      },
    })

    // Set valid date and time, but empty description
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = tomorrow.toISOString().split('T')[0]

    await wrapper.find('input[type="date"]').setValue(tomorrowStr)
    await wrapper.find('input[type="time"]').setValue('14:00')
    await wrapper.find('textarea').setValue('')

    // @ts-ignore
    const isValid = wrapper.vm.validateForm()

    expect(isValid).toBe(false)
    // @ts-ignore
    expect(Object.keys(wrapper.vm.validationErrors).length).toBeGreaterThan(0)
  })

  it('shows multiple errors at once', async () => {
    const wrapper = mount(TrackingDateModal, {
      props: {
        requestId: 123,
      },
    })

    // Set invalid time and empty description
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = tomorrow.toISOString().split('T')[0]

    await wrapper.find('input[type="date"]').setValue(tomorrowStr)
    await wrapper.find('input[type="time"]').setValue('25:00') // Invalid time
    await wrapper.find('textarea').setValue('') // Empty description

    // @ts-ignore
    wrapper.vm.validateForm()
    await wrapper.vm.$nextTick()

    // @ts-ignore
    expect(wrapper.vm.validationErrors.time).toBeDefined()
    // @ts-ignore
    expect(wrapper.vm.validationErrors.description).toBeDefined()
  })
})
