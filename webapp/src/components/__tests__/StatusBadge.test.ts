import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import StatusBadge from '@/components/StatusBadge.vue'

describe('StatusBadge', () => {
  it('renders CO as 已完成 with green class', () => {
    const w = mount(StatusBadge, { props: { status: 'CO' } })
    expect(w.text()).toBe('已完成')
    expect(w.find('.status-co').exists()).toBe(true)
  })

  it('renders DR as 草稿', () => {
    const w = mount(StatusBadge, { props: { status: 'DR' } })
    expect(w.text()).toBe('草稿')
    expect(w.find('.status-dr').exists()).toBe(true)
  })

  it('renders VO as 已作廢', () => {
    const w = mount(StatusBadge, { props: { status: 'VO' } })
    expect(w.text()).toBe('已作廢')
    expect(w.find('.status-vo').exists()).toBe(true)
  })

  it('renders unknown status as raw code', () => {
    const w = mount(StatusBadge, { props: { status: 'XX' } })
    expect(w.text()).toBe('XX')
  })
})
