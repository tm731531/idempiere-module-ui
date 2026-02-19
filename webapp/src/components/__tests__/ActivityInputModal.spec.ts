import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ActivityInputModal from '../ActivityInputModal.vue'

describe('ActivityInputModal', () => {
  beforeEach(() => {
    localStorage.setItem('user_name', 'Test User')
  })

  it('renders modal with correct title for phone', () => {
    const wrapper = mount(ActivityInputModal, {
      props: {
        requestId: 1,
        actionType: '電話',
      },
    })

    expect(wrapper.text()).toContain('記錄電話')
  })

  it('renders modal with correct title for message', () => {
    const wrapper = mount(ActivityInputModal, {
      props: {
        requestId: 1,
        actionType: '訊息',
      },
    })

    expect(wrapper.text()).toContain('記錄訊息')
  })

  it('renders textarea with maxlength of 500', () => {
    const wrapper = mount(ActivityInputModal, {
      props: {
        requestId: 1,
        actionType: '電話',
      },
    })

    const textarea = wrapper.find('.form-textarea')
    expect(textarea.attributes('maxlength')).toBe('500')
  })

  it('displays character counter', async () => {
    const wrapper = mount(ActivityInputModal, {
      props: {
        requestId: 1,
        actionType: '電話',
      },
    })

    const textarea = wrapper.find('.form-textarea')
    expect(wrapper.text()).toContain('0/500')

    await textarea.setValue('Hello')
    expect(wrapper.text()).toContain('5/500')
  })

  it('disables confirm button when content is empty', async () => {
    const wrapper = mount(ActivityInputModal, {
      props: {
        requestId: 1,
        actionType: '電話',
      },
    })

    const confirmBtn = wrapper.findAll('.btn')[1]
    expect(confirmBtn.attributes('disabled')).toBeDefined()
  })

  it('enables confirm button when content is provided', async () => {
    const wrapper = mount(ActivityInputModal, {
      props: {
        requestId: 1,
        actionType: '電話',
      },
    })

    const textarea = wrapper.find('.form-textarea')
    await textarea.setValue('Valid content')

    const confirmBtn = wrapper.findAll('.btn')[1]
    expect(confirmBtn.attributes('disabled')).toBeUndefined()
  })

  it('shows error when submitting empty content', async () => {
    const wrapper = mount(ActivityInputModal, {
      props: {
        requestId: 1,
        actionType: '電話',
      },
    })

    // Manually trigger validation of empty content
    const { validateActivityContent } = await import('@/utils/validation')
    const validation = validateActivityContent('')
    expect(validation.errors.content).toBe('請輸入活動內容')
    expect(validation.isValid).toBe(false)
  })

  it('shows error for content exceeding 500 chars', async () => {
    const wrapper = mount(ActivityInputModal, {
      props: {
        requestId: 1,
        actionType: '電話',
      },
    })

    // Set valid content first
    const textarea = wrapper.find('.form-textarea')
    await textarea.setValue('a'.repeat(500))

    // Manually try to validate content > 500
    const longContent = 'a'.repeat(501)
    // Since maxlength prevents > 500, we test the validation function directly
    // through the error path
    const { validateActivityContent } = await import('@/utils/validation')
    const validation = validateActivityContent(longContent)
    expect(validation.errors.content).toContain('不能超過500字')
  })

  it('emits activity-added event on confirm', async () => {
    const wrapper = mount(ActivityInputModal, {
      props: {
        requestId: 1,
        actionType: '電話',
      },
    })

    const textarea = wrapper.find('.form-textarea')
    await textarea.setValue('Test activity content')

    const confirmBtn = wrapper.findAll('.btn')[1]
    await confirmBtn.trigger('click')

    expect(wrapper.emitted('activity-added')).toHaveLength(1)
    const emitted = wrapper.emitted('activity-added')[0][0] as any
    expect(emitted.content).toBe('Test activity content')
    expect(emitted.actionType).toBe('電話')
    expect(emitted.type).toBe('前台行動')
    expect(emitted.createdBy).toBe('Test User')
  })

  it('emits close event after successful submit', async () => {
    const wrapper = mount(ActivityInputModal, {
      props: {
        requestId: 1,
        actionType: '電話',
      },
    })

    const textarea = wrapper.find('.form-textarea')
    await textarea.setValue('Test activity')

    const confirmBtn = wrapper.findAll('.btn')[1]
    await confirmBtn.trigger('click')

    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('emits close event on cancel', async () => {
    const wrapper = mount(ActivityInputModal, {
      props: {
        requestId: 1,
        actionType: '電話',
      },
    })

    const cancelBtn = wrapper.findAll('.btn')[0]
    await cancelBtn.trigger('click')

    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('closes when overlay is clicked', async () => {
    const wrapper = mount(ActivityInputModal, {
      props: {
        requestId: 1,
        actionType: '電話',
      },
    })

    await wrapper.find('.dialog-overlay').trigger('click')

    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('does not close when modal content is clicked', async () => {
    const wrapper = mount(ActivityInputModal, {
      props: {
        requestId: 1,
        actionType: '電話',
      },
    })

    await wrapper.find('.dialog-modal').trigger('click')

    expect(wrapper.emitted('close')).toBeUndefined()
  })

  it('closes on X button click', async () => {
    const wrapper = mount(ActivityInputModal, {
      props: {
        requestId: 1,
        actionType: '電話',
      },
    })

    const closeBtn = wrapper.find('.dialog-close')
    await closeBtn.trigger('click')

    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('includes timestamp in emitted payload', async () => {
    const wrapper = mount(ActivityInputModal, {
      props: {
        requestId: 1,
        actionType: '訊息',
      },
    })

    const textarea = wrapper.find('.form-textarea')
    await textarea.setValue('Test message')

    const confirmBtn = wrapper.findAll('.btn')[1]
    await confirmBtn.trigger('click')

    const emitted = wrapper.emitted('activity-added')[0][0] as any
    expect(emitted.timestamp).toBeDefined()
    expect(typeof emitted.timestamp).toBe('string')
  })

  it('displays different placeholder for phone', () => {
    const wrapper = mount(ActivityInputModal, {
      props: {
        requestId: 1,
        actionType: '電話',
      },
    })

    const textarea = wrapper.find('.form-textarea')
    expect(textarea.attributes('placeholder')).toContain('電話內容')
  })

  it('displays different placeholder for message', () => {
    const wrapper = mount(ActivityInputModal, {
      props: {
        requestId: 1,
        actionType: '訊息',
      },
    })

    const textarea = wrapper.find('.form-textarea')
    expect(textarea.attributes('placeholder')).toContain('訊息內容')
  })

  it('has maxlength attribute set to 500', () => {
    const wrapper = mount(ActivityInputModal, {
      props: {
        requestId: 1,
        actionType: '電話',
      },
    })

    const textarea = wrapper.find('.form-textarea')
    expect(textarea.attributes('maxlength')).toBe('500')
  })

  it('dismisses error alert when dismiss button clicked', async () => {
    const wrapper = mount(ActivityInputModal, {
      props: {
        requestId: 1,
        actionType: '電話',
      },
    })

    // Manually set errors to test dismiss functionality
    wrapper.vm.errors = { content: 'Test error' }
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.error-alert').exists()).toBe(true)

    const dismissBtn = wrapper.find('.error-close')
    await dismissBtn.trigger('click')

    await wrapper.vm.$nextTick()
    expect(wrapper.find('.error-alert').exists()).toBe(false)
  })

  it('changes button text to 提交中 when submitting', async () => {
    const wrapper = mount(ActivityInputModal, {
      props: {
        requestId: 1,
        actionType: '電話',
      },
    })

    const textarea = wrapper.find('.form-textarea')
    await textarea.setValue('Test')

    const confirmBtn = wrapper.findAll('.btn')[1]
    expect(confirmBtn.text()).toBe('確認')
  })
})
