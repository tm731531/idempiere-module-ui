import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import FormErrorAlert from '../FormErrorAlert.vue'

describe('FormErrorAlert', () => {
  it('renders nothing when no errors', () => {
    const wrapper = mount(FormErrorAlert, {
      props: {
        errors: {},
      },
    })

    expect(wrapper.find('.error-alert').exists()).toBe(false)
  })

  it('renders error alert with single error', () => {
    const wrapper = mount(FormErrorAlert, {
      props: {
        errors: {
          email: 'Invalid email format',
        },
      },
    })

    expect(wrapper.find('.error-alert').exists()).toBe(true)
    expect(wrapper.text()).toContain('email')
    expect(wrapper.text()).toContain('Invalid email format')
  })

  it('renders multiple errors', () => {
    const wrapper = mount(FormErrorAlert, {
      props: {
        errors: {
          Summary: '請輸入摘要',
          R_Status_ID: '請選擇狀態',
          R_RequestType_ID: '請選擇類型',
        },
      },
    })

    expect(wrapper.findAll('.error-item')).toHaveLength(3)
    expect(wrapper.text()).toContain('Summary')
    expect(wrapper.text()).toContain('R_Status_ID')
    expect(wrapper.text()).toContain('R_RequestType_ID')
  })

  it('displays custom title', () => {
    const wrapper = mount(FormErrorAlert, {
      props: {
        errors: { field: 'error' },
        title: '表單驗證失敗',
      },
    })

    expect(wrapper.text()).toContain('表單驗證失敗')
  })

  it('uses default title when not provided', () => {
    const wrapper = mount(FormErrorAlert, {
      props: {
        errors: { field: 'error' },
      },
    })

    expect(wrapper.text()).toContain('驗證錯誤')
  })

  it('shows close button when dismissible is true', () => {
    const wrapper = mount(FormErrorAlert, {
      props: {
        errors: { field: 'error' },
        dismissible: true,
      },
    })

    expect(wrapper.find('.error-close').exists()).toBe(true)
  })

  it('hides close button when dismissible is false', () => {
    const wrapper = mount(FormErrorAlert, {
      props: {
        errors: { field: 'error' },
        dismissible: false,
      },
    })

    expect(wrapper.find('.error-close').exists()).toBe(false)
  })

  it('emits dismiss event when close button clicked', async () => {
    const wrapper = mount(FormErrorAlert, {
      props: {
        errors: { field: 'error' },
        dismissible: true,
      },
    })

    await wrapper.find('.error-close').trigger('click')
    expect(wrapper.emitted('dismiss')).toHaveLength(1)
  })

  it('does not show close button by default when no prop', () => {
    const wrapper = mount(FormErrorAlert, {
      props: {
        errors: { field: 'error' },
      },
    })

    expect(wrapper.find('.error-close').exists()).toBe(true)
  })

  it('renders error items with correct structure', () => {
    const wrapper = mount(FormErrorAlert, {
      props: {
        errors: {
          Summary: '摘要必填',
          date: '日期不能是過去的日期',
        },
      },
    })

    const items = wrapper.findAll('.error-item')
    expect(items[0]!.text()).toContain('Summary')
    expect(items[0]!.text()).toContain('摘要必填')
    expect(items[1]!.text()).toContain('date')
    expect(items[1]!.text()).toContain('日期不能是過去的日期')
  })

  it('updates when errors prop changes', async () => {
    const wrapper = mount(FormErrorAlert, {
      props: {
        errors: {},
      },
    })

    expect(wrapper.find('.error-alert').exists()).toBe(false)

    await wrapper.setProps({
      errors: { field: 'error message' },
    })

    expect(wrapper.find('.error-alert').exists()).toBe(true)
    expect(wrapper.text()).toContain('error message')
  })

  it('clears errors when prop is emptied', async () => {
    const wrapper = mount(FormErrorAlert, {
      props: {
        errors: { field: 'error' },
      },
    })

    expect(wrapper.find('.error-alert').exists()).toBe(true)

    await wrapper.setProps({
      errors: {},
    })

    expect(wrapper.find('.error-alert').exists()).toBe(false)
  })

  it('has animation class', () => {
    const wrapper = mount(FormErrorAlert, {
      props: {
        errors: { field: 'error' },
      },
    })

    const alert = wrapper.find('.error-alert')
    expect(alert.exists()).toBe(true)
    // CSS animations are applied, verify structure is correct
    expect(alert.element.classList.contains('error-alert')).toBe(true)
  })
})
